const refundOpSql = require('../../sql/refundOperationSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const { isUniqueViolation } = require('../../../db/transaction');
const { buildIdempotencyKey } = require('./refundPolicy');

async function persistPaymentIntentIfNeeded(reservation, paymentIntentId, client = null) {
  if (
    reservation.stripePaymentIntentId &&
    String(reservation.stripePaymentIntentId) === String(paymentIntentId)
  ) {
    return reservation;
  }

  return reservationSql.applyStatusChange(
    {
      reservationId: reservation.id,
      newStatus: reservation.status,
      patch: { stripePaymentIntentId: paymentIntentId },
    },
    client
  );
}

async function markRefundFailed(op, err, client = null) {
  return refundOpSql.updateRefundOperation(
    op.id,
    {
      status: 'failed',
      failureCode: err.code || err.type || 'refund_failed',
      failureMessage: err.message || 'Refund failed',
      stripeRawStatus: 'failed',
    },
    client
  );
}

async function createPendingOperation({
  reservation,
  order,
  paymentIntentId,
  amountCents,
  currency,
  reason,
  requestedByUserId,
  attempt = 1,
}) {
  const idempotencyKey = buildIdempotencyKey(reservation.id, attempt);
  try {
    return await refundOpSql.insertRefundOperation({
      reservationId: reservation.id,
      orderId: order?.id || null,
      stripePaymentIntentId: paymentIntentId,
      amountCents,
      currency,
      status: 'pending',
      idempotencyKey,
      requestedByUserId,
      reason,
    });
  } catch (err) {
    if (!isUniqueViolation(err)) {
      throw err;
    }
    const byKey = await refundOpSql.findByIdempotencyKey(idempotencyKey);
    if (byKey) return byKey;
    const active = await refundOpSql.findActiveByReservationId(reservation.id);
    if (active) return active;
    if (attempt < 5) {
      return createPendingOperation({
        reservation,
        order,
        paymentIntentId,
        amountCents,
        currency,
        reason,
        requestedByUserId,
        attempt: attempt + 1,
      });
    }
    throw err;
  }
}

module.exports = {
  persistPaymentIntentIfNeeded,
  markRefundFailed,
  createPendingOperation,
};
