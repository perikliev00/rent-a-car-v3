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

function succeededResponse(reserved) {
  return {
    status: reserved.status,
    refundOperation: reserved.refundOperation,
    reservation: reserved.reservation,
    idempotent: reserved.idempotent,
  };
}

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
    const locked = await reservationSql.findByIdForUpdate(reservationId, tx);
    if (!locked) {
      throw refundError('NOT_FOUND', 'Reservation not found.', 404);
    }

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
