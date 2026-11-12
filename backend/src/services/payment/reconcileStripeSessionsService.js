/**
 * Shared Stripe checkout session reconcile used by admin API and CLI.
 * Bridges gaps when webhooks were missed: finds processing reservations that
 * already have a Stripe session, verifies payment with Stripe, and finalizes
 * when paid. Uses stub-aware retrieve so STRIPE_STUB=1 e2e works in-process.
 */
const reservationRepository = require('../../repositories/reservationRepository');
// Destructure object properties into local variables.
const { findOrderByStripeSessionId } = require('../sql/orderSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  finalizeReservationByStripeSessionId,
// Continue the surrounding logic with this statement.
} = require('../bookingFinalizationService');
// Require the '../sql/paymentFailureSqlService' module as paymentFailureSql.
const paymentFailureSql = require('../sql/paymentFailureSqlService');
// Destructure object properties into local variables.
const { retrieveStripeCheckoutSession } = require('./stripeCheckoutService');

/**
 * Reconcile a single reservation against its linked Stripe Checkout session.
 * Skips work when an order already exists (idempotent re-run safety).
 *
 * @param {object} reservation - Reservation with stripeSessionId and related fields
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<object>} Summary of action taken (or that would be taken)
 */
async function reconcileOneSession(reservation, { dryRun = false } = {}) {
  // Create the stripe session id constant.
  const stripeSessionId = reservation.stripeSessionId;
  // Create the summary constant.
  const summary = {
    // Provide the reservation id field value.
    reservationId: reservation.id,
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Provide the action field value.
    action: 'skipped',
    // Provide the reason field value.
    reason: null,
    // Provide the finalized field value.
    finalized: false,
  };

  // Stripe / payment-related branch.
  if (!stripeSessionId) {
    // Update summary.reason with the right-hand side value.
    summary.reason = 'missing_stripe_session_id';
    // Return the resulting value to the caller.
    return summary;
  }

  // Order already linked to this session ⇒ booking was confirmed; clear failure rows.
  const existingOrder = await findOrderByStripeSessionId(stripeSessionId);
  // Idempotency guard: return early when work was already applied.
  if (existingOrder) {
    // Update summary.action with the right-hand side value.
    summary.action = 'already_confirmed';
    // Guard: early-return or throw when required input is missing/invalid.
    if (!dryRun) {
      // Wait until the asynchronous operation resolves.
      await paymentFailureSql.markFailuresResolvedByStripeSession(stripeSessionId);
    }
    // Return the resulting value to the caller.
    return summary;
  }

  // Reserve the session variable for later assignment.
  let session;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in session.
    session = await retrieveStripeCheckoutSession(stripeSessionId);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Update summary.reason with the right-hand side value.
    summary.reason = `stripe_retrieve_failed:${err.message}`;
    // Return the resulting value to the caller.
    return summary;
  }

  // Only finalize when Stripe reports paid; unpaid/open sessions stay processing.
  if (session.payment_status !== 'paid') {
    // Update summary.reason with the right-hand side value.
    summary.reason = `payment_status_${session.payment_status}`;
    // Return the resulting value to the caller.
    return summary;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (dryRun) {
    // Update summary.action with the right-hand side value.
    summary.action = 'would_finalize';
    // Return the resulting value to the caller.
    return summary;
  }

  // Create the metadata constant.
  const metadata = session.metadata || {};
  // Create the result constant.
  const result = await finalizeReservationByStripeSessionId(stripeSessionId, {
    // Provide the reservation id field value.
    reservationId: metadata.reservationId || session.client_reference_id || reservation.id,
    // Provide the car id field value.
    carId: metadata.carId || reservation.carId?.id || reservation.carId,
    // Provide the session id field value.
    sessionId: metadata.sessionId || reservation.sessionId,
    // Provide the stripe session payment status field value.
    stripeSessionPaymentStatus: session.payment_status,
    // Provide the stripe session amount total field value.
    stripeSessionAmountTotal: session.amount_total ?? null,
    // Provide the stripe session currency field value.
    stripeSessionCurrency: session.currency || null,
    // Provide the log prefix field value.
    logPrefix: '[ReconcileStripeSessions]',
  });

  // Update summary.action with the right-hand side value.
  summary.action = result.reason || 'unknown';
  // Update summary.finalized with the right-hand side value.
  summary.finalized = !!result.finalized;

  // Idempotency guard: return early when work was already applied.
  if (result.finalized || result.reason === 'already_confirmed') {
    // Wait until the asynchronous operation resolves.
    await paymentFailureSql.markFailuresResolvedByStripeSession(stripeSessionId);
  }

  // Return the resulting value to the caller.
  return summary;
}

/**
 * Batch-reconcile processing reservations that have a Stripe session id.
 *
 * @param {{ dryRun?: boolean, limit?: number }} [options]
 * @returns {Promise<{ dryRun: boolean, processed: number, finalizedOrReady: number, skipped: number, results: object[] }>}
 */
async function reconcileStripeSessions({ dryRun = false, limit = 50 } = {}) {
  // Create the reservations constant.
  const reservations = await reservationRepository.findProcessingWithStripeSession();
  // Create the candidates constant.
  const candidates = reservations.slice(0, limit);

  // Create the results constant.
  const results = [];
  // Initialize the mutable finalized or ready variable.
  let finalizedOrReady = 0;
  // Initialize the mutable skipped variable.
  let skipped = 0;

  // Iterate using the loop initializer, condition, and step.
  for (const reservation of candidates) {
    // Create the summary constant.
    const summary = await reconcileOneSession(reservation, { dryRun });
    // Call results.push to perform this step.
    results.push(summary);

    // Evaluate the condition and enter the branch when it is true.
    if (
      // Contribute this line to the enclosing declaration or statement.
      summary.finalized ||
      // Update summary.action with the right-hand side value.
      summary.action === 'already_confirmed' ||
      // Update summary.action with the right-hand side value.
      summary.action === 'would_finalize'
    // Continue the surrounding logic with this statement.
    ) {
      // Update finalizedOrReady with the right-hand side value.
      finalizedOrReady += 1;
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Update skipped with the right-hand side value.
      skipped += 1;
    }
  }

  // Return the resulting value to the caller.
  return {
    // Provide the dry run field value.
    dryRun: !!dryRun,
    // Provide the processed field value.
    processed: candidates.length,
    // Contribute this line to the enclosing declaration or statement.
    finalizedOrReady,
    // Contribute this line to the enclosing declaration or statement.
    skipped,
    // Contribute this line to the enclosing declaration or statement.
    results,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  reconcileStripeSessions,
  // Contribute this line to the enclosing declaration or statement.
  reconcileOneSession,
};
