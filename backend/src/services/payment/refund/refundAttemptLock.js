/**
 * Transactional lock for starting a refund attempt on a reservation.
 * Serializes concurrent refund starts, returns idempotent success when already refunded,
 * and creates a pending ledger row when none is active.
 */
const reservationSql = require('../../sql/reservationSqlService');
// Require the '../../sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { runWithTransaction } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { refundError } = require('./refundErrors');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  assertRefundableStatus,
  // Contribute this line to the enclosing declaration or statement.
  requireSucceededLedgerForRefunded,
// Continue the surrounding logic with this statement.
} = require('./refundPolicy');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  persistPaymentIntentIfNeeded,
  // Contribute this line to the enclosing declaration or statement.
  createPendingOperation,
// Continue the surrounding logic with this statement.
} = require('./refundLedgerService');

/**
 * Shape a reserved/succeeded lock result for the refund orchestrator.
 * @param {object} reserved
 * @returns {object}
 */
function succeededResponse(reserved) {
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: reserved.status,
    // Provide the refund operation field value.
    refundOperation: reserved.refundOperation,
    // Provide the reservation field value.
    reservation: reserved.reservation,
    // Provide the idempotent field value.
    idempotent: reserved.idempotent,
  };
}

/**
 * Lock the reservation row, validate refundability, and ensure a pending refund op exists.
 *
 * @param {object} params
 * @returns {Promise<{ done: true, status: string, refundOperation: object, reservation: object, idempotent: boolean } | { done: false, reservation: object, op: object }>}
 */
async function lockAndCreateAttempt({
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  paymentIntentId,
  // Contribute this line to the enclosing declaration or statement.
  amountCents,
  // Contribute this line to the enclosing declaration or statement.
  currency,
  // Contribute this line to the enclosing declaration or statement.
  order,
  // Contribute this line to the enclosing declaration or statement.
  reason,
  // Contribute this line to the enclosing declaration or statement.
  requestedByUserId,
  // Contribute this line to the enclosing declaration or statement.
  attempt,
// Continue the surrounding logic with this statement.
}) {
  // Return the resulting value to the caller.
  return runWithTransaction(async (tx) => {
    // FOR UPDATE prevents two admins from creating parallel pending refunds.
    const locked = await reservationSql.findByIdForUpdate(reservationId, tx);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!locked) {
      // Throw an error to stop the current control flow.
      throw refundError('NOT_FOUND', 'Reservation not found.', 404);
    }

    // Status / lifecycle guard before mutating domain state.
    if (locked.status === 'refunded') {
      // Create the existing constant.
      const existing = await refundOpSql.findActiveByReservationId(locked.id, tx);
      // Call requireSucceededLedgerForRefunded to perform this step.
      requireSucceededLedgerForRefunded(locked, existing);
      // Return the resulting value to the caller.
      return {
        // Provide the done field value.
        done: true,
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refund operation field value.
        refundOperation: existing,
        // Provide the reservation field value.
        reservation: locked,
        // Provide the idempotent field value.
        idempotent: true,
      };
    }

    // Call assertRefundableStatus to perform this step.
    assertRefundableStatus(locked.status);
    // Wait until the asynchronous operation resolves.
    await persistPaymentIntentIfNeeded(locked, paymentIntentId, tx);

    // Create the active constant.
    const active = await refundOpSql.findActiveByReservationId(locked.id, tx);
    // Status / lifecycle guard before mutating domain state.
    if (active?.status === 'succeeded') {
      // Return the resulting value to the caller.
      return {
        // Provide the done field value.
        done: true,
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refund operation field value.
        refundOperation: active,
        // Provide the reservation field value.
        reservation: locked,
        // Provide the idempotent field value.
        idempotent: true,
      };
    }
    // Evaluate the condition and enter the branch when it is true.
    if (active) {
      // Resume the in-flight pending/failed op rather than inserting another.
      return { done: false, reservation: locked, op: active };
    }

    // Create the op constant.
    const op = await createPendingOperation({
      // Provide the reservation field value.
      reservation: locked,
      // Contribute this line to the enclosing declaration or statement.
      order,
      // Contribute this line to the enclosing declaration or statement.
      paymentIntentId,
      // Contribute this line to the enclosing declaration or statement.
      amountCents,
      // Contribute this line to the enclosing declaration or statement.
      currency,
      // Contribute this line to the enclosing declaration or statement.
      reason,
      // Contribute this line to the enclosing declaration or statement.
      requestedByUserId,
      // Contribute this line to the enclosing declaration or statement.
      attempt,
      // Provide the client field value.
      client: tx,
    });
    // Return the resulting value to the caller.
    return { done: false, reservation: locked, op };
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  succeededResponse,
  // Contribute this line to the enclosing declaration or statement.
  lockAndCreateAttempt,
};
