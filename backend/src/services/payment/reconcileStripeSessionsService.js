/**
 * Shared Stripe checkout session reconcile used by admin API and CLI.
 * Bridges gaps when webhooks were missed: finds processing reservations that
 * already have a Stripe session, verifies payment with Stripe, and finalizes
 * when paid. Uses stub-aware retrieve so STRIPE_STUB=1 e2e works in-process.
 */
const reservationRepository = require('../../repositories/reservationRepository');
const { findOrderByStripeSessionId } = require('../sql/orderSqlService');
const {
  finalizeReservationByStripeSessionId,
} = require('../bookingFinalizationService');
const paymentFailureSql = require('../sql/paymentFailureSqlService');
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
  const stripeSessionId = reservation.stripeSessionId;
  const summary = {
    reservationId: reservation.id,
    stripeSessionId,
    action: 'skipped',
    reason: null,
    finalized: false,
  };

  // Stripe / payment-related branch.
  if (!stripeSessionId) {
    summary.reason = 'missing_stripe_session_id';
    return summary;
  }

  // Order already linked to this session ⇒ booking was confirmed; clear failure rows.
  const existingOrder = await findOrderByStripeSessionId(stripeSessionId);
  // Idempotency guard: return early when work was already applied.
  if (existingOrder) {
    summary.action = 'already_confirmed';
    // Guard: early-return or throw when required input is missing/invalid.
    if (!dryRun) {
      await paymentFailureSql.markFailuresResolvedByStripeSession(stripeSessionId);
    }
    return summary;
  }

  let session;
  // Protected block: isolate failure modes.
  try {
    session = await retrieveStripeCheckoutSession(stripeSessionId);
  } catch (err) {
    summary.reason = `stripe_retrieve_failed:${err.message}`;
    return summary;
  }

  // Only finalize when Stripe reports paid; unpaid/open sessions stay processing.
  if (session.payment_status !== 'paid') {
    summary.reason = `payment_status_${session.payment_status}`;
    return summary;
  }

  if (dryRun) {
    summary.action = 'would_finalize';
    return summary;
  }

  const metadata = session.metadata || {};
  const result = await finalizeReservationByStripeSessionId(stripeSessionId, {
    reservationId: metadata.reservationId || session.client_reference_id || reservation.id,
    carId: metadata.carId || reservation.carId?.id || reservation.carId,
    sessionId: metadata.sessionId || reservation.sessionId,
    stripeSessionPaymentStatus: session.payment_status,
    stripeSessionAmountTotal: session.amount_total ?? null,
    stripeSessionCurrency: session.currency || null,
    logPrefix: '[ReconcileStripeSessions]',
  });

  summary.action = result.reason || 'unknown';
  summary.finalized = !!result.finalized;

  // Idempotency guard: return early when work was already applied.
  if (result.finalized || result.reason === 'already_confirmed') {
    await paymentFailureSql.markFailuresResolvedByStripeSession(stripeSessionId);
  }

  return summary;
}

/**
 * Batch-reconcile processing reservations that have a Stripe session id.
 *
 * @param {{ dryRun?: boolean, limit?: number }} [options]
 * @returns {Promise<{ dryRun: boolean, processed: number, finalizedOrReady: number, skipped: number, results: object[] }>}
 */
async function reconcileStripeSessions({ dryRun = false, limit = 50 } = {}) {
  const reservations = await reservationRepository.findProcessingWithStripeSession();
  const candidates = reservations.slice(0, limit);

  const results = [];
  let finalizedOrReady = 0;
  let skipped = 0;

  for (const reservation of candidates) {
    const summary = await reconcileOneSession(reservation, { dryRun });
    results.push(summary);

    if (
      summary.finalized ||
      summary.action === 'already_confirmed' ||
      summary.action === 'would_finalize'
    ) {
      finalizedOrReady += 1;
    } else {
      skipped += 1;
    }
  }

  return {
    dryRun: !!dryRun,
    processed: candidates.length,
    finalizedOrReady,
    skipped,
    results,
  };
}

module.exports = {
  reconcileStripeSessions,
  reconcileOneSession,
};
