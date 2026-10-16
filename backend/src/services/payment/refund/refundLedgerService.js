/**
 * Local refund ledger helpers: persist PI/paid amount, create pending ops with
 * idempotency keys, and mark failed / resurrect pending after reconcile.
 */
const refundOpSql = require('../../sql/refundOperationSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const { isUniqueViolation } = require('../../../db/transaction');
const { buildIdempotencyKey } = require('./refundPolicy');

/**
 * Backfill paidAmountCents on the reservation when missing (from Stripe snapshot).
 */
async function persistPaidAmountIfNeeded(
  reservation,
  { paidAmountCents, paidCurrency } = {},
  client = null
) {
  if (reservation.paidAmountCents != null && Number(reservation.paidAmountCents) > 0) {
    return reservation;
  }

  const cents = Number(paidAmountCents);
  // Guard: early-return or throw when required input is missing/invalid.
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

/**
 * Persist PaymentIntent id when not yet stored (needed for later refunds).
 */
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

/**
 * Resolve updated refund operation from inputs / Stripe / DB.
 * @param {*} op
 * @param {*} updated
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function resolveUpdatedRefundOperation(op, updated, client = null) {
  if (updated) {
    return updated;
  }
  return (await refundOpSql.findById(op.id, client)) || op;
}

/**
 * Mark a refund operation failed with Stripe/error details.
 */
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

/**
 * Move a failed op back to pending when Stripe still shows pending (false-failure reconcile).
 */
async function resurrectPending(op, { stripeRefundId, stripeRawStatus } = {}, client = null) {
  const patch = {
    status: 'pending',
    stripeRawStatus: stripeRawStatus || 'pending',
    failureCode: null,
    failureMessage: null,
  };
  // Stripe / payment-related branch.
  if (stripeRefundId !== undefined) {
    patch.stripeRefundId = stripeRefundId;
  }
  const updated = await refundOpSql.updateRefundOperation(op.id, patch, client);
  return resolveUpdatedRefundOperation(op, updated, client);
}

/**
 * Insert a pending refund operation; on unique key conflict, return existing or retry attempt.
 *
 * @param {object} params
 * @returns {Promise<object>} Refund operation row
 */
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
  // Protected block: isolate failure modes.
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
    // Guard: early-return or throw when required input is missing/invalid.
    if (!isUniqueViolation(err)) {
      throw err;
    }
    // Concurrent insert with same key — reuse pending/succeeded row.
    const byKey = await refundOpSql.findByIdempotencyKey(idempotencyKey, client);
    // Status / lifecycle guard before mutating domain state.
    if (byKey && (byKey.status === 'pending' || byKey.status === 'succeeded')) {
      return byKey;
    }
    const active = await refundOpSql.findActiveByReservationId(reservation.id, client);
    if (active) {
      return active;
    }
    // Failed key: bump attempt for a new Stripe idempotency key.
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
