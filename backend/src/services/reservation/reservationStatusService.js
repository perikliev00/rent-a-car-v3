/**
 * Single entrypoint for reservation status transitions.
 * Enforces domain transition rules, blocks unsafe changes during pending refunds,
 * writes status history, syncs car fleet / booking calendar, and notifies auditors.
 */
const { runWithTransaction } = require('../../db/transaction');
const reservationSql = require('../sql/reservationSqlService');
const historySql = require('../sql/reservationStatusHistorySqlService');
const refundOpSql = require('../sql/refundOperationSqlService');
const { assertTransition } = require('../../domain/reservationStatus');
const { isAllowedDuringPendingRefund } = require('../payment/refund/refundPolicy');
const { logAdminAction, logSystemAction, logCustomerAction } = require('../admin/adminAuditService');
const logger = require('../../utils/logger');

const statusChangeListeners = [];

/**
 * Register a listener invoked after a successful status change (outside the DB write).
 * @param {(event: object) => void|Promise<void>} listener
 * @returns {() => void} Unsubscribe function
 */
function registerStatusChangeListener(listener) {
  if (typeof listener === 'function') {
    statusChangeListeners.push(listener);
  }
  return () => {
    const idx = statusChangeListeners.indexOf(listener);
    // Status / lifecycle guard before mutating domain state.
    if (idx >= 0) statusChangeListeners.splice(idx, 1);
  };
}

/**
 * notify listeners.
 * @param {*} event
 * @returns {Promise<*>}
 */
async function notifyListeners(event) {
  for (const listener of statusChangeListeners) {
    // Protected block: isolate failure modes.
    try {
      await listener(event);
    } catch (err) {
      logger.error({ err, context: 'reservationStatusListener' }, 'Status change listener failed');
    }
  }
}

/**
 * audit status change.
 * @param {*} event
 * @returns {Promise<*>}
 */
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

  // Protected block: isolate failure modes.
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

/**
 * Transactional core: lock row, validate, apply status/patch, history, calendar side effects.
 */
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
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const oldStatus = reservation.status;

  // Pending refund: only allow transitions that complete or stay in refund-safe statuses.
  if (oldStatus !== newStatus) {
    const activeRefund = await refundOpSql.findActiveByReservationId(reservationId, client);
    // Status / lifecycle guard before mutating domain state.
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

  // Status / lifecycle guard before mutating domain state.
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
 * Pass an existing `client` to participate in an outer transaction.
 *
 * @param {object} params
 * @param {string|number} params.reservationId
 * @param {string} params.newStatus
 * @param {string|null} [params.reason]
 * @param {object|null} [params.metadata]
 * @param {{ type?: string, req?: object, userId?: * }} [params.actor]
 * @param {object|null} [params.patch] - Extra field updates applied with the status change
 * @param {object|null} [params.client]
 * @returns {Promise<{ reservation: object, changed: boolean, oldStatus: string, newStatus: string, event?: object }>}
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
  // Status / lifecycle guard before mutating domain state.
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
