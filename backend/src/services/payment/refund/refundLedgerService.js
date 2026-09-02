const refundOpSql = require('../../sql/refundOperationSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const { isUniqueViolation } = require('../../../db/transaction');
const { buildIdempotencyKey } = require('./refundPolicy');

async function persistPaidAmountIfNeeded(
  reservation,
  { paidAmountCents, paidCurrency } = {},
  client = null
) {
  if (reservation.paidAmountCents != null && Number(reservation.paidAmountCents) > 0) {
    return reservation;
  }

  const cents = Number(paidAmountCents);
  if (!Number.isFinite(cents) || cents <= 0) {
    return reservation;
  }

  return reservationSql.applyStatusChange(
    {
      reservationId: reservation.id,
      newStatus: reservation.status,
      patch: {
        paidAmountCents: cents,
        paidCurrency: paidCurrency || reservation.paidCurrency || 'eur',
      },
    },
    client
  );
}

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

async function resolveUpdatedRefundOperation(op, updated, client = null) {
  if (updated) {
    return updated;
  }
  return (await refundOpSql.findById(op.id, client)) || op;
}

async function markRefundFailed(op, err, client = null) {
  const updated = await refundOpSql.updateRefundOperation(
    op.id,
    {
      status: 'failed',
      failureCode: err.code || err.type || 'refund_failed',
      failureMessage: err.message || 'Refund failed',
      stripeRawStatus: 'failed',
    },
    client
  );
  return resolveUpdatedRefundOperation(op, updated, client);
}

async function resurrectPending(op, { stripeRefundId, stripeRawStatus } = {}, client = null) {
  const patch = {
    status: 'pending',
    stripeRawStatus: stripeRawStatus || 'pending',
    failureCode: null,
    failureMessage: null,
  };
  if (stripeRefundId !== undefined) {
    patch.stripeRefundId = stripeRefundId;
  }
  const updated = await refundOpSql.updateRefundOperation(op.id, patch, client);
  return resolveUpdatedRefundOperation(op, updated, client);
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
  client = null,
}) {
  const idempotencyKey = buildIdempotencyKey(reservation.id, attempt);
  try {
    return await refundOpSql.insertRefundOperation(
      {
        reservationId: reservation.id,
        orderId: order?.id || null,
        stripePaymentIntentId: paymentIntentId,
        amountCents,
        currency,
        status: 'pending',
        idempotencyKey,
        requestedByUserId,
        reason,
      },
      client
    );
  } catch (err) {
    if (!isUniqueViolation(err)) {
      throw err;
    }
    const byKey = await refundOpSql.findByIdempotencyKey(idempotencyKey, client);
    if (byKey && (byKey.status === 'pending' || byKey.status === 'succeeded')) {
      return byKey;
    }
    const active = await refundOpSql.findActiveByReservationId(reservation.id, client);
    if (active) {
      return active;
    }
    if (attempt < 5 && (!byKey || byKey.status === 'failed')) {
      return createPendingOperation({
        reservation,
        order,
        paymentIntentId,
        amountCents,
        currency,
        reason,
        requestedByUserId,
        attempt: attempt + 1,
        client,
      });
    }
    throw err;
  }
}

module.exports = {
  persistPaymentIntentIfNeeded,
  persistPaidAmountIfNeeded,
  resolveUpdatedRefundOperation,
  markRefundFailed,
  resurrectPending,
  createPendingOperation,
};
