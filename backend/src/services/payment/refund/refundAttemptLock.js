/**
 * Transactional lock for starting a refund attempt on a reservation.
 * Serializes concurrent refund starts, returns idempotent success when already refunded,
 * and creates a pending ledger row when none is active.
 */
const reservationSql = require('../../sql/reservationSqlService');
const refundOpSql = require('../../sql/refundOperationSqlService');
const { runWithTransaction } = require('../../../db/transaction');
const { refundError } = require('./refundErrors');
const {
  assertRefundableStatus,
  requireSucceededLedgerForRefunded,
} = require('./refundPolicy');
const {
  persistPaymentIntentIfNeeded,
  createPendingOperation,
} = require('./refundLedgerService');

/**
 * Shape a reserved/succeeded lock result for the refund orchestrator.
 * @param {object} reserved
 * @returns {object}
 */
function succeededResponse(reserved) {
  return {
    status: reserved.status,
    refundOperation: reserved.refundOperation,
    reservation: reserved.reservation,
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
  reservationId,
  paymentIntentId,
  amountCents,
  currency,
  order,
  reason,
  requestedByUserId,
  attempt,
}) {
  return runWithTransaction(async (tx) => {
    // FOR UPDATE prevents two admins from creating parallel pending refunds.
    const locked = await reservationSql.findByIdForUpdate(reservationId, tx);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!locked) {
      throw refundError('NOT_FOUND', 'Reservation not found.', 404);
    }

    // Status / lifecycle guard before mutating domain state.
    if (locked.status === 'refunded') {
      const existing = await refundOpSql.findActiveByReservationId(locked.id, tx);
      requireSucceededLedgerForRefunded(locked, existing);
      return {
        done: true,
        status: 'succeeded',
        refundOperation: existing,
        reservation: locked,
        idempotent: true,
      };
    }

    assertRefundableStatus(locked.status);
    await persistPaymentIntentIfNeeded(locked, paymentIntentId, tx);

    const active = await refundOpSql.findActiveByReservationId(locked.id, tx);
    // Status / lifecycle guard before mutating domain state.
    if (active?.status === 'succeeded') {
      return {
        done: true,
        status: 'succeeded',
        refundOperation: active,
        reservation: locked,
        idempotent: true,
      };
    }
    if (active) {
      // Resume the in-flight pending/failed op rather than inserting another.
      return { done: false, reservation: locked, op: active };
    }

    const op = await createPendingOperation({
      reservation: locked,
      order,
      paymentIntentId,
      amountCents,
      currency,
      reason,
      requestedByUserId,
      attempt,
      client: tx,
    });
    return { done: false, reservation: locked, op };
  });
}

module.exports = {
  succeededResponse,
  lockAndCreateAttempt,
};
