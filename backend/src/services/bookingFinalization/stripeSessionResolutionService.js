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

function isStripeSessionPaid(paymentStatus) {
  return paymentStatus === 'paid';
}

async function resolveStripeCheckoutSessionDetails(stripeSessionId, options = {}) {
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

async function resolveStripePaymentStatus(stripeSessionId, options = {}) {
  if (options.stripeSessionPaymentStatus) {
    return options.stripeSessionPaymentStatus;
  }

  if (options.isStripeSessionPaid === true) {
    return 'paid';
  }

  if (options.isStripeSessionPaid === false) {
    return 'unpaid';
  }

  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  return session.payment_status;
}

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

async function validateStripeSessionForFinalization({
  reservation,
  stripeSessionId,
  options,
  logPrefix,
  client,
}) {
  const sessionLink = validateActiveStripeSessionLink(reservation, stripeSessionId);

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
