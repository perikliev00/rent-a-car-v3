/**
 * Local refund ledger helpers: persist PI/paid amount, create pending ops with
 * idempotency keys, and mark failed / resurrect pending after reconcile.
 */
const refundOpSql = require('../../sql/refundOperationSqlService');
// Require the '../../sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../sql/reservationSqlService');
// Destructure object properties into local variables.
const { isUniqueViolation } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { buildIdempotencyKey } = require('./refundPolicy');

/**
 * Backfill paidAmountCents on the reservation when missing (from Stripe snapshot).
 */
async function persistPaidAmountIfNeeded(
  // Contribute this line to the enclosing declaration or statement.
  reservation,
  // Continue the surrounding logic with this statement.
  { paidAmountCents, paidCurrency } = {},
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Evaluate the condition and enter the branch when it is true.
  if (reservation.paidAmountCents != null && Number(reservation.paidAmountCents) > 0) {
    // Return the resulting value to the caller.
    return reservation;
  }

  // Create the cents constant.
  const cents = Number(paidAmountCents);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isFinite(cents) || cents <= 0) {
    // Return the resulting value to the caller.
    return reservation;
  }

  // Return the resulting value to the caller.
  return reservationSql.applyStatusChange(
    {
      // Provide the reservation id field value.
      reservationId: reservation.id,
      // Provide the new status field value.
      newStatus: reservation.status,
      // Provide the patch field value.
      patch: {
        // Provide the paid amount cents field value.
        paidAmountCents: cents,
        // Provide the paid currency field value.
        paidCurrency: paidCurrency || reservation.paidCurrency || 'eur',
      },
    },
    // Reference the identifier used by the enclosing expression.
    client
  );
}

/**
 * Persist PaymentIntent id when not yet stored (needed for later refunds).
 */
async function persistPaymentIntentIfNeeded(reservation, paymentIntentId, client = null) {
  // Evaluate the condition and enter the branch when it is true.
  if (
    // Contribute this line to the enclosing declaration or statement.
    reservation.stripePaymentIntentId &&
    // Call String to perform this step.
    String(reservation.stripePaymentIntentId) === String(paymentIntentId)
  // Continue the surrounding logic with this statement.
  ) {
    // Return the resulting value to the caller.
    return reservation;
  }

  // Return the resulting value to the caller.
  return reservationSql.applyStatusChange(
    {
      // Provide the reservation id field value.
      reservationId: reservation.id,
      // Provide the new status field value.
      newStatus: reservation.status,
      // Provide the patch field value.
      patch: { stripePaymentIntentId: paymentIntentId },
    },
    // Reference the identifier used by the enclosing expression.
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
  // Evaluate the condition and enter the branch when it is true.
  if (updated) {
    // Return the resulting value to the caller.
    return updated;
  }
  // Return the resulting value to the caller.
  return (await refundOpSql.findById(op.id, client)) || op;
}

/**
 * Mark a refund operation failed with Stripe/error details.
 */
async function markRefundFailed(op, err, client = null) {
  // Create the updated constant.
  const updated = await refundOpSql.updateRefundOperation(
    // Contribute this line to the enclosing declaration or statement.
    op.id,
    {
      // Provide the status field value.
      status: 'failed',
      // Provide the failure code field value.
      failureCode: err.code || err.type || 'refund_failed',
      // Provide the failure message field value.
      failureMessage: err.message || 'Refund failed',
      // Provide the stripe raw status field value.
      stripeRawStatus: 'failed',
    },
    // Reference the identifier used by the enclosing expression.
    client
  );
  // Return the resulting value to the caller.
  return resolveUpdatedRefundOperation(op, updated, client);
}

/**
 * Move a failed op back to pending when Stripe still shows pending (false-failure reconcile).
 */
async function resurrectPending(op, { stripeRefundId, stripeRawStatus } = {}, client = null) {
  // Create the patch constant.
  const patch = {
    // Provide the status field value.
    status: 'pending',
    // Provide the stripe raw status field value.
    stripeRawStatus: stripeRawStatus || 'pending',
    // Provide the failure code field value.
    failureCode: null,
    // Provide the failure message field value.
    failureMessage: null,
  };
  // Stripe / payment-related branch.
  if (stripeRefundId !== undefined) {
    // Update patch.stripeRefundId with the right-hand side value.
    patch.stripeRefundId = stripeRefundId;
  }
  // Create the updated constant.
  const updated = await refundOpSql.updateRefundOperation(op.id, patch, client);
  // Return the resulting value to the caller.
  return resolveUpdatedRefundOperation(op, updated, client);
}

/**
 * Insert a pending refund operation; on unique key conflict, return existing or retry attempt.
 *
 * @param {object} params
 * @returns {Promise<object>} Refund operation row
 */
async function createPendingOperation({
  // Contribute this line to the enclosing declaration or statement.
  reservation,
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
  // Update attempt with the right-hand side value.
  attempt = 1,
  // Update client with the right-hand side value.
  client = null,
// Continue the surrounding logic with this statement.
}) {
  // Create the idempotency key constant.
  const idempotencyKey = buildIdempotencyKey(reservation.id, attempt);
  // Protected block: isolate failure modes.
  try {
    // Return the resulting value to the caller.
    return await refundOpSql.insertRefundOperation(
      {
        // Provide the reservation id field value.
        reservationId: reservation.id,
        // Provide the order id field value.
        orderId: order?.id || null,
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: paymentIntentId,
        // Contribute this line to the enclosing declaration or statement.
        amountCents,
        // Contribute this line to the enclosing declaration or statement.
        currency,
        // Provide the status field value.
        status: 'pending',
        // Contribute this line to the enclosing declaration or statement.
        idempotencyKey,
        // Contribute this line to the enclosing declaration or statement.
        requestedByUserId,
        // Contribute this line to the enclosing declaration or statement.
        reason,
      },
      // Reference the identifier used by the enclosing expression.
      client
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Guard: early-return or throw when required input is missing/invalid.
    if (!isUniqueViolation(err)) {
      // Throw an error to stop the current control flow.
      throw err;
    }
    // Concurrent insert with same key — reuse pending/succeeded row.
    const byKey = await refundOpSql.findByIdempotencyKey(idempotencyKey, client);
    // Status / lifecycle guard before mutating domain state.
    if (byKey && (byKey.status === 'pending' || byKey.status === 'succeeded')) {
      // Return the resulting value to the caller.
      return byKey;
    }
    // Create the active constant.
    const active = await refundOpSql.findActiveByReservationId(reservation.id, client);
    // Evaluate the condition and enter the branch when it is true.
    if (active) {
      // Return the resulting value to the caller.
      return active;
    }
    // Failed key: bump attempt for a new Stripe idempotency key.
    if (attempt < 5 && (!byKey || byKey.status === 'failed')) {
      // Return the resulting value to the caller.
      return createPendingOperation({
        // Contribute this line to the enclosing declaration or statement.
        reservation,
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
        // Provide the attempt field value.
        attempt: attempt + 1,
        // Contribute this line to the enclosing declaration or statement.
        client,
      });
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  persistPaymentIntentIfNeeded,
  // Contribute this line to the enclosing declaration or statement.
  persistPaidAmountIfNeeded,
  // Contribute this line to the enclosing declaration or statement.
  resolveUpdatedRefundOperation,
  // Contribute this line to the enclosing declaration or statement.
  markRefundFailed,
  // Contribute this line to the enclosing declaration or statement.
  resurrectPending,
  // Contribute this line to the enclosing declaration or statement.
  createPendingOperation,
};
