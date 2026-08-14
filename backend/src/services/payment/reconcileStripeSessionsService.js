/**
 * Shared Stripe checkout session reconcile used by admin API and CLI.
 * Uses stub-aware retrieve so STRIPE_STUB=1 e2e works in-process.
 */
const reservationRepository = require('../../repositories/reservationRepository');
const { findOrderByStripeSessionId } = require('../sql/orderSqlService');
const {
  finalizeReservationByStripeSessionId,
} = require('../bookingFinalizationService');
const paymentFailureSql = require('../sql/paymentFailureSqlService');
const { retrieveStripeCheckoutSession } = require('./stripeCheckoutService');

async function reconcileOneSession(reservation, { dryRun = false } = {}) {
  const stripeSessionId = reservation.stripeSessionId;
  const summary = {
    reservationId: reservation.id,
    stripeSessionId,
    action: 'skipped',
    reason: null,
    finalized: false,
  };

  if (!stripeSessionId) {
    summary.reason = 'missing_stripe_session_id';
    return summary;
  }

  const existingOrder = await findOrderByStripeSessionId(stripeSessionId);
  if (existingOrder) {
    summary.action = 'already_confirmed';
    if (!dryRun) {
      await paymentFailureSql.markFailuresResolvedByStripeSession(stripeSessionId);
    }
    return summary;
  }

  let session;
  try {
    session = await retrieveStripeCheckoutSession(stripeSessionId);
  } catch (err) {
    summary.reason = `stripe_retrieve_failed:${err.message}`;
    return summary;
  }

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

  if (result.finalized || result.reason === 'already_confirmed') {
    await paymentFailureSql.markFailuresResolvedByStripeSession(stripeSessionId);
  }

  return summary;
}

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
