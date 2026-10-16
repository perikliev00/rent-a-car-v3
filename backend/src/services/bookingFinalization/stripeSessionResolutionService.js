/**
 * Resolve reservation + Stripe Checkout session details for finalization,
 * and validate that the incoming session is the active linked one with
 * matching amount/currency before confirming payment.
 */
const reservationRepository = require('../../repositories/reservationRepository');
const stripe = require('../../config/stripe');
const logger = require('../../utils/logger');
const { trackPaymentFailure } = require('../../monitoring/track');
const {
  validateActiveStripeSessionLink,
  validateStripePaymentDetails,
  paidSnapshotFromStripeSession,
  paidSnapshotFromFinalizationContext,
  buildStripeSessionSnapshot,
} = require('../payment/stripeSessionValidation');
const { markPaidReservationConflict } = require('./paidConflictManualReviewService');

/**
 * @param {string|null|undefined} paymentStatus
 * @returns {boolean}
 */
function isStripeSessionPaid(paymentStatus) {
  return paymentStatus === 'paid';
}

/**
 * Prefer caller-supplied session snapshot to avoid redundant Stripe API calls.
 * @param {string} stripeSessionId
 * @param {object} [options]
 * @returns {Promise<object>}
 */
async function resolveStripeCheckoutSessionDetails(stripeSessionId, options = {}) {
  // Stripe / payment-related branch.
  if (options.stripeCheckoutSession) {
    return options.stripeCheckoutSession;
  }

  if (
    options.stripeSessionAmountTotal != null &&
    options.stripeSessionCurrency &&
    options.stripeSessionPaymentStatus
  ) {
    return {
      id: stripeSessionId,
      payment_status: options.stripeSessionPaymentStatus,
      amount_total: options.stripeSessionAmountTotal,
      currency: options.stripeSessionCurrency,
    };
  }

  return stripe.checkout.sessions.retrieve(stripeSessionId);
}

/**
 * Reject finalization; if the session is paid, escalate to manual_review instead of dropping money.
 */
async function rejectStripeFinalization({
  reservation,
  stripeSessionId,
  reason,
  logPrefix,
  client,
  conflictReason,
  paidAmount,
  paidAmountCents = null,
  paidCurrency = null,
  trackReason,
  extraContext = {},
}) {
  if (trackReason) {
    trackPaymentFailure(trackReason, {
      reservationId: reservation?.id?.toString?.(),
      stripeSessionId,
      logPrefix,
      ...extraContext,
    });
  }

  // Status / lifecycle guard before mutating domain state.
  if (conflictReason && isStripeSessionPaid(extraContext.paymentStatus)) {
    return markPaidReservationConflict({
      reservation,
      stripeSessionId,
      conflictReason,
      paidAmount,
      paidAmountCents,
      paidCurrency,
      logPrefix,
      client,
      resultReason: reason,
    });
  }

  return {
    found: true,
    finalized: false,
    reservation,
    order: null,
    reason,
  };
}

/**
 * Resolve payment_status from options or live Stripe retrieve.
 * @param {string} stripeSessionId
 * @param {object} [options]
 * @returns {Promise<string>}
 */
async function resolveStripePaymentStatus(stripeSessionId, options = {}) {
  // Status / lifecycle guard before mutating domain state.
  if (options.stripeSessionPaymentStatus) {
    return options.stripeSessionPaymentStatus;
  }

  // Stripe / payment-related branch.
  if (options.isStripeSessionPaid === true) {
    return 'paid';
  }

  // Stripe / payment-related branch.
  if (options.isStripeSessionPaid === false) {
    return 'unpaid';
  }

  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  return session.payment_status;
}

/**
 * Ensure metadata from the Stripe session matches the reservation row.
 */
function reservationMatchesMetadata(reservation, { reservationId, carId, sessionId } = {}) {
  if (reservationId && String(reservation.id) !== String(reservationId)) {
    return false;
  }

  if (carId) {
    const actualCarId = String(reservation.carId?.id || reservation.carId);
    if (actualCarId !== String(carId)) {
      return false;
    }
  }

  if (sessionId && reservation.sessionId !== sessionId) {
    return false;
  }

  return true;
}

/**
 * Find reservation by linked Stripe session, then metadata reservationId / browse session.
 * @returns {Promise<object|null>}
 */
async function resolveReservationForStripeSession(
  stripeSessionId,
  metadata = {},
  client = null
) {
  let reservation = await reservationRepository.findByStripeSessionId(stripeSessionId, client);
  if (reservation) {
    return reservation;
  }

  const reservationId = metadata.reservationId ? String(metadata.reservationId) : null;
  const carId = metadata.carId ? String(metadata.carId) : null;
  const sessionId = metadata.sessionId ? String(metadata.sessionId) : null;

  if (reservationId) {
    reservation = await reservationRepository.findById(reservationId, client);
    if (
      reservation &&
      reservationMatchesMetadata(reservation, { reservationId, carId, sessionId })
    ) {
      return reservation;
    }
  }

  if (sessionId) {
    reservation = await reservationRepository.findActiveBySessionId(sessionId, client);
    if (
      reservation &&
      reservationMatchesMetadata(reservation, { reservationId, carId, sessionId })
    ) {
      return reservation;
    }
  }

  return null;
}

/**
 * Validate active session link and amount/currency before confirming payment.
 * @returns {Promise<{ ok: true, stripeSession: object } | object>}
 */
async function validateStripeSessionForFinalization({
  reservation,
  stripeSessionId,
  options,
  logPrefix,
  client,
}) {
  const sessionLink = validateActiveStripeSessionLink(reservation, stripeSessionId);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!sessionLink.ok) {
    logger.warn(
      {
        incomingSessionId: sessionLink.incomingSessionId,
        activeSessionId: sessionLink.activeSessionId,
        reservationId: reservation.id?.toString?.(),
        logPrefix,
      },
      'Ignoring stale Stripe checkout session'
    );

    const paymentStatus = await resolveStripePaymentStatus(stripeSessionId, options);
    const paidSnapshot = paidSnapshotFromFinalizationContext(options);

    return rejectStripeFinalization({
      reservation,
      stripeSessionId,
      reason: 'stale_stripe_session',
      logPrefix,
      client,
      conflictReason: 'stale_stripe_session',
      paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
      paidAmountCents: paidSnapshot.paidAmountCents,
      paidCurrency: paidSnapshot.paidCurrency,
      trackReason: 'stale_stripe_session',
      extraContext: {
        paymentStatus,
        activeSessionId: sessionLink.activeSessionId,
        incomingSessionId: sessionLink.incomingSessionId,
      },
    });
  }

  const stripeSession = await resolveStripeCheckoutSessionDetails(stripeSessionId, options);
  const paymentDetails = validateStripePaymentDetails(stripeSession, reservation);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!paymentDetails.ok) {
    logger.warn(
      {
        reservationId: reservation.id?.toString?.(),
        stripeSessionId,
        reason: paymentDetails.reason,
        expectedAmount: paymentDetails.expectedAmount,
        actualAmount: paymentDetails.actualAmount,
        expectedCurrency: paymentDetails.expectedCurrency,
        actualCurrency: paymentDetails.actualCurrency,
        logPrefix,
      },
      'Stripe checkout session failed payment validation'
    );

    const paidSnapshot = paidSnapshotFromStripeSession(stripeSession);

    return rejectStripeFinalization({
      reservation,
      stripeSessionId,
      reason: paymentDetails.reason,
      logPrefix,
      client,
      conflictReason: paymentDetails.reason,
      paidAmount: stripeSession.amount_total != null ? stripeSession.amount_total / 100 : null,
      paidAmountCents: paidSnapshot.paidAmountCents,
      paidCurrency: paidSnapshot.paidCurrency,
      trackReason: paymentDetails.reason,
      extraContext: {
        paymentStatus: stripeSession.payment_status,
        ...paymentDetails,
        stripeSession: buildStripeSessionSnapshot(stripeSession),
      },
    });
  }

  return { ok: true, stripeSession };
}

module.exports = {
  isStripeSessionPaid,
  resolveStripeCheckoutSessionDetails,
  rejectStripeFinalization,
  resolveStripePaymentStatus,
  reservationMatchesMetadata,
  resolveReservationForStripeSession,
  validateStripeSessionForFinalization,
};
