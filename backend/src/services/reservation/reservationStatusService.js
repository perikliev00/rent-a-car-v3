/**
 * Single entrypoint for reservation status transitions.
 * Enforces domain transition rules, blocks unsafe changes during pending refunds,
 * writes status history, syncs car fleet / booking calendar, and notifies auditors.
 */
const { runWithTransaction } = require('../../db/transaction');
// Require the '../sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../sql/reservationSqlService');
// Require the '../sql/reservationStatusHistorySqlService' module as historySql.
const historySql = require('../sql/reservationStatusHistorySqlService');
// Require the '../sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { assertTransition } = require('../../domain/reservationStatus');
// Destructure object properties into local variables.
const { isAllowedDuringPendingRefund } = require('../payment/refund/refundPolicy');
// Destructure object properties into local variables.
const { logAdminAction, logSystemAction, logCustomerAction } = require('../admin/adminAuditService');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');

// Create the status change listeners constant.
const statusChangeListeners = [];

/**
 * Register a listener invoked after a successful status change (outside the DB write).
 * @param {(event: object) => void|Promise<void>} listener
 * @returns {() => void} Unsubscribe function
 */
function registerStatusChangeListener(listener) {
  // Evaluate the condition and enter the branch when it is true.
  if (typeof listener === 'function') {
    // Call statusChangeListeners.push to perform this step.
    statusChangeListeners.push(listener);
  }
  // Return the resulting value to the caller.
  return () => {
    // Create the idx constant.
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
  // Iterate using the loop initializer, condition, and step.
  for (const listener of statusChangeListeners) {
    // Protected block: isolate failure modes.
    try {
      // Wait until the asynchronous operation resolves.
      await listener(event);
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call logger.error to perform this step.
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
  // Destructure object properties into local variables.
  const { actor, reservationId, oldStatus, newStatus, reason, metadata } = event;
  // Create the payload constant.
  const payload = {
    // Provide the action field value.
    action: `${actor?.type || 'system'}.reservation_status_changed`,
    // Provide the entity type field value.
    entityType: 'reservation',
    // Provide the entity id field value.
    entityId: reservationId,
    // Provide the metadata field value.
    metadata: {
      // Contribute this line to the enclosing declaration or statement.
      oldStatus,
      // Contribute this line to the enclosing declaration or statement.
      newStatus,
      // Provide the reason field value.
      reason: reason || null,
      // Call ... to perform this step.
      ...(metadata && typeof metadata === 'object' ? metadata : {}),
    },
  };

  // Protected block: isolate failure modes.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (actor?.type === 'admin' && actor.req) {
      // Wait until the asynchronous operation resolves.
      await logAdminAction(actor.req, payload);
    // Continue the surrounding logic with this statement.
    } else if (actor?.type === 'customer' && actor.req) {
      // Wait until the asynchronous operation resolves.
      await logCustomerAction(actor.req, payload);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Wait until the asynchronous operation resolves.
      await logSystemAction(payload);
    }
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'auditStatusChange' }, 'Failed to audit reservation status change');
  }
}

// Call registerStatusChangeListener to perform this step.
registerStatusChangeListener(auditStatusChange);

/**
 * Transactional core: lock row, validate, apply status/patch, history, calendar side effects.
 */
async function changeStatusCore({
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  newStatus,
  // Update reason with the right-hand side value.
  reason = null,
  // Update metadata with the right-hand side value.
  metadata = null,
  // Update actor with the right-hand side value.
  actor = { type: 'system' },
  // Update patch with the right-hand side value.
  patch = null,
  // Contribute this line to the enclosing declaration or statement.
  client,
// Continue the surrounding logic with this statement.
}) {
  // Create the reservation constant.
  const reservation = await reservationSql.findByIdForUpdate(reservationId, client);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the old status constant.
  const oldStatus = reservation.status;

  // Pending refund: only allow transitions that complete or stay in refund-safe statuses.
  if (oldStatus !== newStatus) {
    // Create the active refund constant.
    const activeRefund = await refundOpSql.findActiveByReservationId(reservationId, client);
    // Status / lifecycle guard before mutating domain state.
    if (activeRefund?.status === 'pending' && !isAllowedDuringPendingRefund(newStatus)) {
      // Create the err constant.
      const err = new Error(
        // Supply the literal value used by the enclosing expression.
        'A refund is pending for this reservation. Pickup and cancellation are blocked until the refund completes.'
      );
      // Update err.code with the right-hand side value.
      err.code = 'REFUND_IN_PROGRESS';
      // Update err.status with the right-hand side value.
      err.status = 409;
      // Throw an error to stop the current control flow.
      throw err;
    }
  }

  // Call assertTransition to perform this step.
  assertTransition(oldStatus, newStatus);

  // Status / lifecycle guard before mutating domain state.
  if (oldStatus === newStatus && !patch) {
    // Return the resulting value to the caller.
    return { reservation, changed: false, oldStatus, newStatus };
  }

  // Create the updated constant.
  const updated = await reservationSql.applyStatusChange(
    {
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Contribute this line to the enclosing declaration or statement.
      newStatus,
      // Contribute this line to the enclosing declaration or statement.
      patch,
    },
    // Reference the identifier used by the enclosing expression.
    client
  );

  // Wait until the asynchronous operation resolves.
  await historySql.insertStatusHistory(
    {
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Contribute this line to the enclosing declaration or statement.
      oldStatus,
      // Contribute this line to the enclosing declaration or statement.
      newStatus,
      // Provide the changed by user id field value.
      changedByUserId: actor?.userId ?? null,
      // Provide the changed by system field value.
      changedBySystem: actor?.type !== 'admin' && actor?.type !== 'customer',
      // Contribute this line to the enclosing declaration or statement.
      reason,
      // Contribute this line to the enclosing declaration or statement.
      metadata,
    },
    // Reference the identifier used by the enclosing expression.
    client
  );

  // Require the '../carFleetSyncService' module as carFleetSync.
  const carFleetSync = require('../carFleetSyncService');
  // Wait until the asynchronous operation resolves.
  await carFleetSync.syncCarStatusFromReservation(
    // Contribute this line to the enclosing declaration or statement.
    { reservation: updated, oldStatus, newStatus },
    // Reference the identifier used by the enclosing expression.
    client
  );

  // Evaluate the condition and enter the branch when it is true.
  if (
    // Continue the surrounding logic with this statement.
    (newStatus === 'cancelled' && oldStatus !== 'cancelled') ||
    // Continue the surrounding logic with this statement.
    (newStatus === 'no_show' && oldStatus !== 'no_show') ||
    // Continue the surrounding logic with this statement.
    (newStatus === 'refunded' && oldStatus !== 'refunded')
  // Continue the surrounding logic with this statement.
  ) {
    // Require the '../sql/bookingSyncSqlService' module as bookingSync.
    const bookingSync = require('../sql/bookingSyncSqlService');
    // Destructure object properties into local variables.
    const { resolveStoredDateRange } = require('../admin/order/orderConflictService');

    // Create the car id constant.
    const carId = updated.carId?.id || updated.carId;
    // Evaluate the condition and enter the branch when it is true.
    if (carId && updated.pickupDate && updated.returnDate) {
      // Destructure object properties into local variables.
      const { storedStart, storedEnd } = await resolveStoredDateRange(
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        updated.pickupDate,
        // Contribute this line to the enclosing declaration or statement.
        updated.returnDate,
        // Reference the identifier used by the enclosing expression.
        client
      );
      // Wait until the asynchronous operation resolves.
      await bookingSync.removeRange(carId, storedStart, storedEnd, client);
    }

    // Soft-delete linked order on cancel and refund (not no_show).
    if (newStatus === 'cancelled' || newStatus === 'refunded') {
      // Destructure object properties into local variables.
      const {
        // Contribute this line to the enclosing declaration or statement.
        softDeleteOrderForReservation,
      // Continue the surrounding logic with this statement.
      } = require('../admin/order/orderReservationSync');
      // Wait until the asynchronous operation resolves.
      await softDeleteOrderForReservation(reservationId, client);
    }
  }

  // Create the event constant.
  const event = {
    // Provide the reservation id field value.
    reservationId: String(reservationId),
    // Contribute this line to the enclosing declaration or statement.
    oldStatus,
    // Contribute this line to the enclosing declaration or statement.
    newStatus,
    // Contribute this line to the enclosing declaration or statement.
    reason,
    // Contribute this line to the enclosing declaration or statement.
    metadata,
    // Contribute this line to the enclosing declaration or statement.
    actor,
    // Provide the reservation field value.
    reservation: updated,
  };

  // Return the resulting value to the caller.
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
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  newStatus,
  // Update reason with the right-hand side value.
  reason = null,
  // Update metadata with the right-hand side value.
  metadata = null,
  // Update actor with the right-hand side value.
  actor = { type: 'system' },
  // Update patch with the right-hand side value.
  patch = null,
  // Update client with the right-hand side value.
  client = null,
// Continue the surrounding logic with this statement.
} = {}) {
  // Status / lifecycle guard before mutating domain state.
  if (!reservationId || !newStatus) {
    // Throw an error to stop the current control flow.
    throw new Error('changeStatus requires reservationId and newStatus');
  }

  // Create the run constant.
  const run = async (trxClient) =>
    // Call changeStatusCore to perform this step.
    changeStatusCore({
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Contribute this line to the enclosing declaration or statement.
      newStatus,
      // Contribute this line to the enclosing declaration or statement.
      reason,
      // Contribute this line to the enclosing declaration or statement.
      metadata,
      // Contribute this line to the enclosing declaration or statement.
      actor,
      // Contribute this line to the enclosing declaration or statement.
      patch,
      // Provide the client field value.
      client: trxClient,
    });

  // Create the result constant.
  const result = client ? await run(client) : await runWithTransaction(run);

  // Evaluate the condition and enter the branch when it is true.
  if (result.event) {
    // Wait until the asynchronous operation resolves.
    await notifyListeners(result.event);
  }

  // Return the resulting value to the caller.
  return result;
}

/**
 * Record initial status when a reservation row is inserted with pending_payment.
 */
async function recordInitialStatus({
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Update status with the right-hand side value.
  status = 'pending_payment',
  // Update reason with the right-hand side value.
  reason = 'created',
  // Update metadata with the right-hand side value.
  metadata = null,
  // Update actor with the right-hand side value.
  actor = { type: 'customer' },
  // Update client with the right-hand side value.
  client = null,
// Continue the surrounding logic with this statement.
} = {}) {
  // Wait until the asynchronous operation resolves.
  await historySql.insertStatusHistory(
    {
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Provide the old status field value.
      oldStatus: null,
      // Provide the new status field value.
      newStatus: status,
      // Provide the changed by user id field value.
      changedByUserId: actor?.userId ?? null,
      // Provide the changed by system field value.
      changedBySystem: actor?.type === 'system',
      // Contribute this line to the enclosing declaration or statement.
      reason,
      // Contribute this line to the enclosing declaration or statement.
      metadata,
    },
    // Reference the identifier used by the enclosing expression.
    client
  );

  // Create the event constant.
  const event = {
    // Provide the reservation id field value.
    reservationId: String(reservationId),
    // Provide the old status field value.
    oldStatus: null,
    // Provide the new status field value.
    newStatus: status,
    // Contribute this line to the enclosing declaration or statement.
    reason,
    // Contribute this line to the enclosing declaration or statement.
    metadata,
    // Contribute this line to the enclosing declaration or statement.
    actor,
  };
  // Wait until the asynchronous operation resolves.
  await notifyListeners(event);
  // Return the resulting value to the caller.
  return event;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  changeStatus,
  // Contribute this line to the enclosing declaration or statement.
  recordInitialStatus,
  // Contribute this line to the enclosing declaration or statement.
  registerStatusChangeListener,
};
