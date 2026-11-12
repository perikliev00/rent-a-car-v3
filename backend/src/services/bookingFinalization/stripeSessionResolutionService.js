/**
 * Resolve reservation + Stripe Checkout session details for finalization,
 * and validate that the incoming session is the active linked one with
 * matching amount/currency before confirming payment.
 */
const reservationRepository = require('../../repositories/reservationRepository');
// Require the '../../config/stripe' module as stripe.
const stripe = require('../../config/stripe');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Destructure object properties into local variables.
const { trackPaymentFailure } = require('../../monitoring/track');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  validateActiveStripeSessionLink,
  // Contribute this line to the enclosing declaration or statement.
  validateStripePaymentDetails,
  // Contribute this line to the enclosing declaration or statement.
  paidSnapshotFromStripeSession,
  // Contribute this line to the enclosing declaration or statement.
  paidSnapshotFromFinalizationContext,
  // Contribute this line to the enclosing declaration or statement.
  buildStripeSessionSnapshot,
// Continue the surrounding logic with this statement.
} = require('../payment/stripeSessionValidation');
// Destructure object properties into local variables.
const { markPaidReservationConflict } = require('./paidConflictManualReviewService');

/**
 * @param {string|null|undefined} paymentStatus
 * @returns {boolean}
 */
function isStripeSessionPaid(paymentStatus) {
  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return options.stripeCheckoutSession;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (
    // Continue the surrounding logic with this statement.
    options.stripeSessionAmountTotal != null &&
    // Contribute this line to the enclosing declaration or statement.
    options.stripeSessionCurrency &&
    // Contribute this line to the enclosing declaration or statement.
    options.stripeSessionPaymentStatus
  // Continue the surrounding logic with this statement.
  ) {
    // Return the resulting value to the caller.
    return {
      // Provide the id field value.
      id: stripeSessionId,
      // Provide the payment status field value.
      payment_status: options.stripeSessionPaymentStatus,
      // Provide the amount total field value.
      amount_total: options.stripeSessionAmountTotal,
      // Provide the currency field value.
      currency: options.stripeSessionCurrency,
    };
  }

  // Return the resulting value to the caller.
  return stripe.checkout.sessions.retrieve(stripeSessionId);
}

/**
 * Reject finalization; if the session is paid, escalate to manual_review instead of dropping money.
 */
async function rejectStripeFinalization({
  // Contribute this line to the enclosing declaration or statement.
  reservation,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  reason,
  // Contribute this line to the enclosing declaration or statement.
  logPrefix,
  // Contribute this line to the enclosing declaration or statement.
  client,
  // Contribute this line to the enclosing declaration or statement.
  conflictReason,
  // Contribute this line to the enclosing declaration or statement.
  paidAmount,
  // Update paidAmountCents with the right-hand side value.
  paidAmountCents = null,
  // Update paidCurrency with the right-hand side value.
  paidCurrency = null,
  // Contribute this line to the enclosing declaration or statement.
  trackReason,
  // Update extraContext with the right-hand side value.
  extraContext = {},
// Continue the surrounding logic with this statement.
}) {
  // Evaluate the condition and enter the branch when it is true.
  if (trackReason) {
    // Call trackPaymentFailure to perform this step.
    trackPaymentFailure(trackReason, {
      // Provide the reservation id field value.
      reservationId: reservation?.id?.toString?.(),
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Contribute this line to the enclosing declaration or statement.
      logPrefix,
      // Spread extraContext into the surrounding structure.
      ...extraContext,
    });
  }

  // Status / lifecycle guard before mutating domain state.
  if (conflictReason && isStripeSessionPaid(extraContext.paymentStatus)) {
    // Return the resulting value to the caller.
    return markPaidReservationConflict({
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Contribute this line to the enclosing declaration or statement.
      conflictReason,
      // Contribute this line to the enclosing declaration or statement.
      paidAmount,
      // Contribute this line to the enclosing declaration or statement.
      paidAmountCents,
      // Contribute this line to the enclosing declaration or statement.
      paidCurrency,
      // Contribute this line to the enclosing declaration or statement.
      logPrefix,
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Provide the result reason field value.
      resultReason: reason,
    });
  }

  // Return the resulting value to the caller.
  return {
    // Provide the found field value.
    found: true,
    // Provide the finalized field value.
    finalized: false,
    // Contribute this line to the enclosing declaration or statement.
    reservation,
    // Provide the order field value.
    order: null,
    // Contribute this line to the enclosing declaration or statement.
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
    // Return the resulting value to the caller.
    return options.stripeSessionPaymentStatus;
  }

  // Stripe / payment-related branch.
  if (options.isStripeSessionPaid === true) {
    // Return the resulting value to the caller.
    return 'paid';
  }

  // Stripe / payment-related branch.
  if (options.isStripeSessionPaid === false) {
    // Return the resulting value to the caller.
    return 'unpaid';
  }

  // Create the session constant.
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  // Return the resulting value to the caller.
  return session.payment_status;
}

/**
 * Ensure metadata from the Stripe session matches the reservation row.
 */
function reservationMatchesMetadata(reservation, { reservationId, carId, sessionId } = {}) {
  // Evaluate the condition and enter the branch when it is true.
  if (reservationId && String(reservation.id) !== String(reservationId)) {
    // Return the resulting value to the caller.
    return false;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (carId) {
    // Create the actual car id constant.
    const actualCarId = String(reservation.carId?.id || reservation.carId);
    // Evaluate the condition and enter the branch when it is true.
    if (actualCarId !== String(carId)) {
      // Return the resulting value to the caller.
      return false;
    }
  }

  // Evaluate the condition and enter the branch when it is true.
  if (sessionId && reservation.sessionId !== sessionId) {
    // Return the resulting value to the caller.
    return false;
  }

  // Return the resulting value to the caller.
  return true;
}

/**
 * Find reservation by linked Stripe session, then metadata reservationId / browse session.
 * @returns {Promise<object|null>}
 */
async function resolveReservationForStripeSession(
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
  // Update metadata with the right-hand side value.
  metadata = {},
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Initialize the mutable reservation variable.
  let reservation = await reservationRepository.findByStripeSessionId(stripeSessionId, client);
  // Evaluate the condition and enter the branch when it is true.
  if (reservation) {
    // Return the resulting value to the caller.
    return reservation;
  }

  // Create the reservation id constant.
  const reservationId = metadata.reservationId ? String(metadata.reservationId) : null;
  // Create the car id constant.
  const carId = metadata.carId ? String(metadata.carId) : null;
  // Create the session id constant.
  const sessionId = metadata.sessionId ? String(metadata.sessionId) : null;

  // Evaluate the condition and enter the branch when it is true.
  if (reservationId) {
    // Store the awaited result in reservation.
    reservation = await reservationRepository.findById(reservationId, client);
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Contribute this line to the enclosing declaration or statement.
      reservation &&
      // Call reservationMatchesMetadata to perform this step.
      reservationMatchesMetadata(reservation, { reservationId, carId, sessionId })
    // Continue the surrounding logic with this statement.
    ) {
      // Return the resulting value to the caller.
      return reservation;
    }
  }

  // Evaluate the condition and enter the branch when it is true.
  if (sessionId) {
    // Store the awaited result in reservation.
    reservation = await reservationRepository.findActiveBySessionId(sessionId, client);
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Contribute this line to the enclosing declaration or statement.
      reservation &&
      // Call reservationMatchesMetadata to perform this step.
      reservationMatchesMetadata(reservation, { reservationId, carId, sessionId })
    // Continue the surrounding logic with this statement.
    ) {
      // Return the resulting value to the caller.
      return reservation;
    }
  }

  // Return the resulting value to the caller.
  return null;
}

/**
 * Validate active session link and amount/currency before confirming payment.
 * @returns {Promise<{ ok: true, stripeSession: object } | object>}
 */
async function validateStripeSessionForFinalization({
  // Contribute this line to the enclosing declaration or statement.
  reservation,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  options,
  // Contribute this line to the enclosing declaration or statement.
  logPrefix,
  // Contribute this line to the enclosing declaration or statement.
  client,
// Continue the surrounding logic with this statement.
}) {
  // Create the session link constant.
  const sessionLink = validateActiveStripeSessionLink(reservation, stripeSessionId);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!sessionLink.ok) {
    // Call logger.warn to perform this step.
    logger.warn(
      {
        // Provide the incoming session id field value.
        incomingSessionId: sessionLink.incomingSessionId,
        // Provide the active session id field value.
        activeSessionId: sessionLink.activeSessionId,
        // Provide the reservation id field value.
        reservationId: reservation.id?.toString?.(),
        // Contribute this line to the enclosing declaration or statement.
        logPrefix,
      },
      // Supply the literal value used by the enclosing expression.
      'Ignoring stale Stripe checkout session'
    );

    // Create the payment status constant.
    const paymentStatus = await resolveStripePaymentStatus(stripeSessionId, options);
    // Create the paid snapshot constant.
    const paidSnapshot = paidSnapshotFromFinalizationContext(options);

    // Return the resulting value to the caller.
    return rejectStripeFinalization({
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Provide the reason field value.
      reason: 'stale_stripe_session',
      // Contribute this line to the enclosing declaration or statement.
      logPrefix,
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Provide the conflict reason field value.
      conflictReason: 'stale_stripe_session',
      // Provide the paid amount field value.
      paidAmount: options.paidAmount ?? reservation.totalPrice ?? null,
      // Provide the paid amount cents field value.
      paidAmountCents: paidSnapshot.paidAmountCents,
      // Provide the paid currency field value.
      paidCurrency: paidSnapshot.paidCurrency,
      // Provide the track reason field value.
      trackReason: 'stale_stripe_session',
      // Provide the extra context field value.
      extraContext: {
        // Contribute this line to the enclosing declaration or statement.
        paymentStatus,
        // Provide the active session id field value.
        activeSessionId: sessionLink.activeSessionId,
        // Provide the incoming session id field value.
        incomingSessionId: sessionLink.incomingSessionId,
      },
    });
  }

  // Create the stripe session constant.
  const stripeSession = await resolveStripeCheckoutSessionDetails(stripeSessionId, options);
  // Create the payment details constant.
  const paymentDetails = validateStripePaymentDetails(stripeSession, reservation);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!paymentDetails.ok) {
    // Call logger.warn to perform this step.
    logger.warn(
      {
        // Provide the reservation id field value.
        reservationId: reservation.id?.toString?.(),
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
        // Provide the reason field value.
        reason: paymentDetails.reason,
        // Provide the expected amount field value.
        expectedAmount: paymentDetails.expectedAmount,
        // Provide the actual amount field value.
        actualAmount: paymentDetails.actualAmount,
        // Provide the expected currency field value.
        expectedCurrency: paymentDetails.expectedCurrency,
        // Provide the actual currency field value.
        actualCurrency: paymentDetails.actualCurrency,
        // Contribute this line to the enclosing declaration or statement.
        logPrefix,
      },
      // Supply the literal value used by the enclosing expression.
      'Stripe checkout session failed payment validation'
    );

    // Create the paid snapshot constant.
    const paidSnapshot = paidSnapshotFromStripeSession(stripeSession);

    // Return the resulting value to the caller.
    return rejectStripeFinalization({
      // Contribute this line to the enclosing declaration or statement.
      reservation,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Provide the reason field value.
      reason: paymentDetails.reason,
      // Contribute this line to the enclosing declaration or statement.
      logPrefix,
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Provide the conflict reason field value.
      conflictReason: paymentDetails.reason,
      // Provide the paid amount field value.
      paidAmount: stripeSession.amount_total != null ? stripeSession.amount_total / 100 : null,
      // Provide the paid amount cents field value.
      paidAmountCents: paidSnapshot.paidAmountCents,
      // Provide the paid currency field value.
      paidCurrency: paidSnapshot.paidCurrency,
      // Provide the track reason field value.
      trackReason: paymentDetails.reason,
      // Provide the extra context field value.
      extraContext: {
        // Provide the payment status field value.
        paymentStatus: stripeSession.payment_status,
        // Spread paymentDetails into the surrounding structure.
        ...paymentDetails,
        // Provide the stripe session field value.
        stripeSession: buildStripeSessionSnapshot(stripeSession),
      },
    });
  }

  // Return the resulting value to the caller.
  return { ok: true, stripeSession };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  isStripeSessionPaid,
  // Contribute this line to the enclosing declaration or statement.
  resolveStripeCheckoutSessionDetails,
  // Contribute this line to the enclosing declaration or statement.
  rejectStripeFinalization,
  // Contribute this line to the enclosing declaration or statement.
  resolveStripePaymentStatus,
  // Contribute this line to the enclosing declaration or statement.
  reservationMatchesMetadata,
  // Contribute this line to the enclosing declaration or statement.
  resolveReservationForStripeSession,
  // Contribute this line to the enclosing declaration or statement.
  validateStripeSessionForFinalization,
};
