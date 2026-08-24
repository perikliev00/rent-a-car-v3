const { runWithTransaction } = require('../../db/transaction');
const reservationSql = require('../sql/reservationSqlService');
const historySql = require('../sql/reservationStatusHistorySqlService');
const refundOpSql = require('../sql/refundOperationSqlService');
const { assertTransition } = require('../../domain/reservationStatus');
const { isAllowedDuringPendingRefund } = require('../payment/refund/refundPolicy');
const { logAdminAction, logSystemAction, logCustomerAction } = require('../admin/adminAuditService');
const logger = require('../../utils/logger');

const statusChangeListeners = [];

function registerStatusChangeListener(listener) {
  if (typeof listener === 'function') {
    statusChangeListeners.push(listener);
  }
  return () => {
    const idx = statusChangeListeners.indexOf(listener);
    if (idx >= 0) statusChangeListeners.splice(idx, 1);
  };
}

async function notifyListeners(event) {
  for (const listener of statusChangeListeners) {
    try {
      await listener(event);
    } catch (err) {
      logger.error({ err, context: 'reservationStatusListener' }, 'Status change listener failed');
    }
  }
}

async function auditStatusChange(event) {
  const { actor, reservationId, oldStatus, newStatus, reason, metadata } = event;
  const payload = {
    action: `${actor?.type || 'system'}.reservation_status_changed`,
    entityType: 'reservation',
    entityId: reservationId,
    metadata: {
      oldStatus,
      newStatus,
      reason: reason || null,
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
    },
  };

  try {
    if (actor?.type === 'admin' && actor.req) {
      await logAdminAction(actor.req, payload);
    } else if (actor?.type === 'customer' && actor.req) {
      await logCustomerAction(actor.req, payload);
    } else {
      await logSystemAction(payload);
    }
  } catch (err) {
    logger.error({ err, context: 'auditStatusChange' }, 'Failed to audit reservation status change');
  }
}

registerStatusChangeListener(auditStatusChange);

async function changeStatusCore({
  reservationId,
  newStatus,
  reason = null,
  metadata = null,
  actor = { type: 'system' },
  patch = null,
  client,
}) {
  const reservation = await reservationSql.findByIdForUpdate(reservationId, client);
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const oldStatus = reservation.status;

  if (oldStatus !== newStatus) {
    const activeRefund = await refundOpSql.findActiveByReservationId(reservationId, client);
    if (activeRefund?.status === 'pending' && !isAllowedDuringPendingRefund(newStatus)) {
      const err = new Error(
        'A refund is pending for this reservation. Pickup and cancellation are blocked until the refund completes.'
      );
      err.code = 'REFUND_IN_PROGRESS';
      err.status = 409;
      throw err;
    }
  }

  assertTransition(oldStatus, newStatus);

  if (oldStatus === newStatus && !patch) {
    return { reservation, changed: false, oldStatus, newStatus };
  }

  const updated = await reservationSql.applyStatusChange(
    {
      reservationId,
      newStatus,
      patch,
    },
    client
  );

  await historySql.insertStatusHistory(
    {
      reservationId,
      oldStatus,
      newStatus,
      changedByUserId: actor?.userId ?? null,
      changedBySystem: actor?.type !== 'admin' && actor?.type !== 'customer',
      reason,
      metadata,
    },
    client
  );

  const carFleetSync = require('../carFleetSyncService');
  await carFleetSync.syncCarStatusFromReservation(
    { reservation: updated, oldStatus, newStatus },
    client
  );

  if (
    (newStatus === 'cancelled' && oldStatus !== 'cancelled') ||
    (newStatus === 'no_show' && oldStatus !== 'no_show') ||
    (newStatus === 'refunded' && oldStatus !== 'refunded')
  ) {
    const bookingSync = require('../sql/bookingSyncSqlService');
    const { resolveStoredDateRange } = require('../admin/order/orderConflictService');

    const carId = updated.carId?.id || updated.carId;
    if (carId && updated.pickupDate && updated.returnDate) {
      const { storedStart, storedEnd } = await resolveStoredDateRange(
        carId,
        updated.pickupDate,
        updated.returnDate,
        client
      );
      await bookingSync.removeRange(carId, storedStart, storedEnd, client);
    }

    // Soft-delete linked order on cancel and refund (not no_show).
    if (newStatus === 'cancelled' || newStatus === 'refunded') {
      const {
        softDeleteOrderForReservation,
      } = require('../admin/order/orderReservationSync');
      await softDeleteOrderForReservation(reservationId, client);
    }
  }

  const event = {
    reservationId: String(reservationId),
    oldStatus,
    newStatus,
    reason,
    metadata,
    actor,
    reservation: updated,
  };

  return { reservation: updated, changed: true, oldStatus, newStatus, event };
}

/**
 * Validates transition, updates reservation status, writes history in one transaction.
 */
async function changeStatus({
  reservationId,
  newStatus,
  reason = null,
  metadata = null,
  actor = { type: 'system' },
  patch = null,
  client = null,
} = {}) {
  if (!reservationId || !newStatus) {
    throw new Error('changeStatus requires reservationId and newStatus');
  }

  const run = async (trxClient) =>
    changeStatusCore({
      reservationId,
      newStatus,
      reason,
      metadata,
      actor,
      patch,
      client: trxClient,
    });

  const result = client ? await run(client) : await runWithTransaction(run);

  if (result.event) {
    await notifyListeners(result.event);
  }

  return result;
}

/**
 * Record initial status when a reservation row is inserted with pending_payment.
 */
async function recordInitialStatus({
  reservationId,
  status = 'pending_payment',
  reason = 'created',
  metadata = null,
  actor = { type: 'customer' },
  client = null,
} = {}) {
  await historySql.insertStatusHistory(
    {
      reservationId,
      oldStatus: null,
      newStatus: status,
      changedByUserId: actor?.userId ?? null,
      changedBySystem: actor?.type === 'system',
      reason,
      metadata,
    },
    client
  );

  const event = {
    reservationId: String(reservationId),
    oldStatus: null,
    newStatus: status,
    reason,
    metadata,
    actor,
  };
  await notifyListeners(event);
  return event;
}

module.exports = {
  changeStatus,
  recordInitialStatus,
  registerStatusChangeListener,
};
