/**
 * Admin/API entrypoint to request a full Stripe refund for a reservation.
 * Locks the reservation, ensures a pending ledger row, then drives Stripe.
 * Re-exports common refund helpers for callers that import this facade.
 */
const reservationRepository = require('../../../repositories/reservationRepository');
// Require the '../../sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../sql/reservationSqlService');
// Require the '../../sql/orderSqlService' module as orderSql.
const orderSql = require('../../sql/orderSqlService');
// Require the '../../sql/refundOperationSqlService' module as refundOpSql.
const refundOpSql = require('../../sql/refundOperationSqlService');
// Destructure object properties into local variables.
const { runWithTransaction } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { resolvePaymentIntentForReservation } = require('./resolvePaymentIntent');
// Destructure object properties into local variables.
const { refundError } = require('./refundErrors');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  REFUNDABLE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  buildIdempotencyKey,
  // Contribute this line to the enclosing declaration or statement.
  parseAttemptFromIdempotencyKey,
  // Contribute this line to the enclosing declaration or statement.
  assertRefundableStatus,
  // Contribute this line to the enclosing declaration or statement.
  requireSucceededLedgerForRefunded,
  // Contribute this line to the enclosing declaration or statement.
  amountCentsFromReservation,
// Continue the surrounding logic with this statement.
} = require('./refundPolicy');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  persistPaymentIntentIfNeeded,
  // Contribute this line to the enclosing declaration or statement.
  persistPaidAmountIfNeeded,
  // Contribute this line to the enclosing declaration or statement.
  createPendingOperation,
// Continue the surrounding logic with this statement.
} = require('./refundLedgerService');
// Destructure object properties into local variables.
const { applySucceededRefund } = require('./applyRefundService');
// Destructure object properties into local variables.
const { applyRefundFromStripeObject } = require('./refundWebhookService');
// Destructure object properties into local variables.
const { reconcilePendingRefunds } = require('./refundReconcileService');
// Destructure object properties into local variables.
const { succeededResponse } = require('./refundAttemptLock');
// Destructure object properties into local variables.
const { driveStripeForOperation } = require('./refundStripeDriver');

/**
 * Request (or resume) a full refund for a reservation.
 * Idempotent when already refunded with a succeeded ledger row.
 *
 * @param {import('express').Request} req
 * @param {{ reservationId: string|number, reason?: string|null }} params
 * @returns {Promise<object>}
 */
async function requestReservationRefund(req, { reservationId, reason = null }) {
  // Create the reservation constant.
  const reservation = await reservationRepository.findById(reservationId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Throw an error to stop the current control flow.
    throw refundError('NOT_FOUND', 'Reservation not found.', 404);
  }

  // Status / lifecycle guard before mutating domain state.
  if (reservation.status === 'refunded') {
    // Create the existing constant.
    const existing = await refundOpSql.findActiveByReservationId(reservation.id);
    // Call requireSucceededLedgerForRefunded to perform this step.
    requireSucceededLedgerForRefunded(reservation, existing);
    // Return the resulting value to the caller.
    return {
      // Provide the status field value.
      status: 'succeeded',
      // Provide the refund operation field value.
      refundOperation: existing,
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Provide the idempotent field value.
      idempotent: true,
    };
  }

  // Create the resolved constant.
  const resolved = await resolvePaymentIntentForReservation(reservation);
  // Create the payment intent id constant.
  const paymentIntentId = resolved.paymentIntentId;
  // Create the currency constant.
  const currency = resolved.currency || 'eur';
  // Create the order constant.
  const order = await orderSql.findOrderByReservationId(reservation.id);
  // Create the requested by user id constant.
  const requestedByUserId = req?.session?.user?.id ?? null;

  // Open a DB transaction so writes commit atomically.
  const reserved = await runWithTransaction(async (tx) => {
    // Create the locked constant.
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
    // Wait until the asynchronous operation resolves.
    await persistPaidAmountIfNeeded(
      // Contribute this line to the enclosing declaration or statement.
      locked,
      {
        // Provide the paid amount cents field value.
        paidAmountCents: resolved.paidAmountCents,
        // Provide the paid currency field value.
        paidCurrency: resolved.currency,
      },
      // Reference the identifier used by the enclosing expression.
      tx
    );

    // Initialize the mutable op variable.
    let op = await refundOpSql.findActiveByReservationId(locked.id, tx);
    // Status / lifecycle guard before mutating domain state.
    if (op?.status === 'succeeded') {
      // Return the resulting value to the caller.
      return {
        // Provide the done field value.
        done: true,
        // Provide the status field value.
        status: 'succeeded',
        // Provide the refund operation field value.
        refundOperation: op,
        // Provide the reservation field value.
        reservation: locked,
        // Provide the idempotent field value.
        idempotent: true,
      };
    }

    // Guard: early-return or throw when required input is missing/invalid.
    if (!op) {
      // Create the amount cents constant.
      const amountCents = amountCentsFromReservation(locked, resolved);
      // Create the latest constant.
      const latest = await refundOpSql.findLatestByReservationId(locked.id, tx);
      // Evaluate the condition and enter the branch when it is true.
      if (!latest) {
        // Store the awaited result in op.
        op = await createPendingOperation({
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
          // Provide the attempt field value.
          attempt: 1,
          // Provide the client field value.
          client: tx,
        });
      // Continue the surrounding logic with this statement.
      } else if (latest.status === 'failed' && latest.stripeRefundId) {
        // Keep the failed op with Stripe id so the driver retrieves it (may still succeed).
        op = latest;
      // Continue the surrounding logic with this statement.
      } else if (latest.status === 'failed') {
        // Create the next attempt constant.
        const nextAttempt = parseAttemptFromIdempotencyKey(latest.idempotencyKey) + 1;
        // Evaluate the condition and enter the branch when it is true.
        if (nextAttempt > 5) {
          // Throw an error to stop the current control flow.
          throw refundError('REFUND_FAILED', 'Stripe refund failed after maximum attempts.');
        }
        // Store the awaited result in op.
        op = await createPendingOperation({
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
          // Provide the attempt field value.
          attempt: nextAttempt,
          // Provide the client field value.
          client: tx,
        });
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Store the awaited result in op.
        op = await createPendingOperation({
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
          // Provide the attempt field value.
          attempt: 1,
          // Provide the client field value.
          client: tx,
        });
      }
    }

    // Return the resulting value to the caller.
    return { done: false, reservation: locked, op };
  });

  // Evaluate the condition and enter the branch when it is true.
  if (reserved.done) {
    // Return the resulting value to the caller.
    return succeededResponse(reserved);
  }

  // Create the amount cents constant.
  const amountCents =
    // Continue the surrounding logic with this statement.
    reserved.op.amountCents != null
      // Contribute this line to the enclosing declaration or statement.
      ? reserved.op.amountCents
      // Continue the surrounding logic with this statement.
      : amountCentsFromReservation(reserved.reservation, resolved);

  // Create the stripe ctx constant.
  const stripeCtx = {
    // Contribute this line to the enclosing declaration or statement.
    req,
    // Provide the reservation field value.
    reservation: reserved.reservation,
    // Contribute this line to the enclosing declaration or statement.
    reason,
    // Contribute this line to the enclosing declaration or statement.
    requestedByUserId,
    // Contribute this line to the enclosing declaration or statement.
    amountCents,
    // Contribute this line to the enclosing declaration or statement.
    paymentIntentId,
    // Provide the currency field value.
    currency: resolved.currency || reserved.op.currency || 'eur',
    // Contribute this line to the enclosing declaration or statement.
    order,
  };

  // Return the resulting value to the caller.
  return driveStripeForOperation(reserved.op, stripeCtx);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  REFUNDABLE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  buildIdempotencyKey,
  // Contribute this line to the enclosing declaration or statement.
  requestReservationRefund,
  // Contribute this line to the enclosing declaration or statement.
  applySucceededRefund,
  // Contribute this line to the enclosing declaration or statement.
  applyRefundFromStripeObject,
  // Contribute this line to the enclosing declaration or statement.
  reconcilePendingRefunds,
};
