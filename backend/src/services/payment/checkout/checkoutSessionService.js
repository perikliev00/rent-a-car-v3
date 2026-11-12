/**
 * Orchestrates Stripe Checkout session create/reuse for a reservation hold.
 * Uses a per-reservation checkout lock, Stripe idempotency keys, and careful
 * expire/reuse of open sessions so guests do not pay twice or orphan paid sessions.
 */
const carRepository = require('../../../repositories/carRepository');
// Require the '../../../repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../../repositories/reservationRepository');
// Require the '../../sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../sql/reservationSqlService');
// Destructure object properties into local variables.
const { NotFoundError } = require('../../../utils/appError');
// Destructure object properties into local variables.
const { getSessionId } = require('../../../utils/reservationHelpers');
// Destructure object properties into local variables.
const { trackPaymentFailure } = require('../../../monitoring/track');
// Require the '../../../monitoring/logEvent' module as logEvent.
const logEvent = require('../../../monitoring/logEvent');
// Require the '../../../monitoring/metrics' module as metrics.
const metrics = require('../../../monitoring/metrics');
// Require the '../../../utils/logger' module as logger.
const logger = require('../../../utils/logger');
// Destructure object properties into local variables.
const { withReservationCheckoutLock, isCheckoutLockBusyError } = require('../../../db/transaction');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildCheckoutIdempotencyKey,
  // Contribute this line to the enclosing declaration or statement.
  createStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  expireStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  retrieveStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  safeExpireSupersededCheckoutSession,
// Continue the surrounding logic with this statement.
} = require('../stripeCheckoutService');
// Destructure object properties into local variables.
const { canLinkNewStripeSession } = require('../stripeSessionValidation');
// Destructure object properties into local variables.
const { validateCheckoutRequest } = require('./checkoutValidationService');
// Destructure object properties into local variables.
const { resolveCheckoutPricing } = require('./checkoutPricingService');
// Destructure object properties into local variables.
const { resolveCheckoutReservation } = require('./checkoutReservationService');
// Destructure object properties into local variables.
const { compensateReservationAfterStripeFailure } = require('./checkoutCompensationService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildRenderOrderPageResponse,
  // Contribute this line to the enclosing declaration or statement.
  buildRedirectResponse,
// Continue the surrounding logic with this statement.
} = require('./checkoutResponseFactory');
// Destructure object properties into local variables.
const { logCustomerAction } = require('../../admin/adminAuditService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../reservation/reservationStatusService');

// Create the unable to start payment constant.
const UNABLE_TO_START_PAYMENT = 'Unable to start payment. Please try again in a minute.';
// Create the payment review message constant.
const PAYMENT_REVIEW_MESSAGE =
  // Supply the literal value used by the enclosing expression.
  'Your payment is being reviewed. Please contact support if you need help.';

/**
 * checkout error response.
 * @param {*} car
 * @param {object} formData
 * @param {*} pricing
 * @param {string} [message]
 * @returns {*}
 */
function checkoutErrorResponse(car, formData, pricing, message = UNABLE_TO_START_PAYMENT) {
  // Return the resulting value to the caller.
  return buildRenderOrderPageResponse(car, formData, message, {
    // Provide the rental days field value.
    rentalDays: pricing.rentalDays,
    // Provide the delivery price field value.
    deliveryPrice: pricing.deliveryPrice,
    // Provide the return price field value.
    returnPrice: pricing.returnPrice,
    // Provide the total price field value.
    totalPrice: pricing.totalPrice,
  });
}

/** When a prior session is already paid, ask the guest to wait for review rather than recreate. */
function paymentReviewResponse(car, formData, pricing) {
  // Return the resulting value to the caller.
  return checkoutErrorResponse(car, formData, pricing, PAYMENT_REVIEW_MESSAGE);
}

/**
 * Predicate helper: is paid or complete.
 * @param {object} session
 * @returns {*}
 */
function isPaidOrComplete(session) {
  // Return the resulting value to the caller.
  return session?.payment_status === 'paid' || session?.status === 'complete';
}

/**
 * expected amount cents.
 * @param {*} pricing
 * @returns {*}
 */
function expectedAmountCents(pricing) {
  // Return the resulting value to the caller.
  return Math.round(Number(pricing.totalPrice) * 100);
}

/**
 * Persist the Stripe session id and move reservation to processing_payment.
 */
async function linkStripeSessionToReservation({
  // Contribute this line to the enclosing declaration or statement.
  req,
  // Contribute this line to the enclosing declaration or statement.
  reservationDoc,
  // Contribute this line to the enclosing declaration or statement.
  stripeSessionId,
// Continue the surrounding logic with this statement.
}) {
  // Destructure object properties into local variables.
  const { reservation: updated } = await changeStatus({
    // Provide the reservation id field value.
    reservationId: reservationDoc.id,
    // Provide the new status field value.
    newStatus: 'processing_payment',
    // Provide the reason field value.
    reason: 'checkout_started',
    // Provide the actor field value.
    actor: { type: 'customer', req, userId: req?.session?.user?.id },
    // Provide the patch field value.
    patch: { stripeSessionId: stripeSessionId },
  });
  // Return the resulting value to the caller.
  return updated;
}

/**
 * Expire a superseded open session and re-fetch to confirm it is expired (not paid).
 * @returns {Promise<{ ok: boolean, paid?: boolean }>}
 */
async function confirmPreviousSessionExpired(sessionId, context) {
  // Create the expire result constant.
  const expireResult = await safeExpireSupersededCheckoutSession(sessionId, context);

  // Evaluate the condition and enter the branch when it is true.
  if (expireResult.paid) {
    // Return the resulting value to the caller.
    return { ok: false, paid: true };
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!expireResult.ok) {
    // Return the resulting value to the caller.
    return { ok: false };
  }

  // Protected block: isolate failure modes.
  try {
    // Double-check: race where payment completed between expire attempt and now.
    const confirmed = await retrieveStripeCheckoutSession(sessionId);
    // Status / lifecycle guard before mutating domain state.
    if (isPaidOrComplete(confirmed)) {
      // Return the resulting value to the caller.
      return { ok: false, paid: true };
    }
    // Status / lifecycle guard before mutating domain state.
    if (confirmed.status !== 'expired') {
      // Return the resulting value to the caller.
      return { ok: false };
    }
    // Return the resulting value to the caller.
    return { ok: true };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.warn to perform this step.
    logger.warn(
      // Contribute this line to the enclosing declaration or statement.
      { err, sessionId, ...context },
      // Supply the literal value used by the enclosing expression.
      'Could not confirm superseded Stripe checkout session is expired'
    );
    // Return the resulting value to the caller.
    return { ok: false };
  }
}

/**
 * Decide whether to reuse, recreate, refuse, or treat an existing linked session as paid.
 * @returns {Promise<{ action: 'create'|'reuse'|'refuse'|'paid', session?: object, sessionId?: string }>}
 */
async function resolveExistingCheckoutSession({
  // Contribute this line to the enclosing declaration or statement.
  reservationDoc,
  // Contribute this line to the enclosing declaration or statement.
  pricing,
  // Contribute this line to the enclosing declaration or statement.
  req,
  // Contribute this line to the enclosing declaration or statement.
  car,
// Continue the surrounding logic with this statement.
}) {
  // Create the previous stripe session id constant.
  const previousStripeSessionId = reservationDoc.stripeSessionId;
  // Stripe / payment-related branch.
  if (!previousStripeSessionId) {
    // Return the resulting value to the caller.
    return { action: 'create' };
  }

  // Create the context constant.
  const context = {
    // Provide the correlation id field value.
    correlationId: req.correlationId,
    // Provide the reservation id field value.
    reservationId: reservationDoc?.id?.toString?.(),
    // Provide the car id field value.
    carId: car?.id?.toString?.(),
  };

  // Reserve the existing session variable for later assignment.
  let existingSession;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in existingSession.
    existingSession = await retrieveStripeCheckoutSession(previousStripeSessionId);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Unknown session state — refuse create to avoid a second charge path.
    logger.warn(
      // Contribute this line to the enclosing declaration or statement.
      { err, sessionId: previousStripeSessionId, ...context },
      // Continue the surrounding logic with this statement.
      'Failed to retrieve existing Stripe checkout session; refusing new create'
    );
    // Return the resulting value to the caller.
    return { action: 'refuse' };
  }

  // Idempotency guard: return early when work was already applied.
  if (isPaidOrComplete(existingSession)) {
    // Return the resulting value to the caller.
    return { action: 'paid', sessionId: previousStripeSessionId };
  }

  // Idempotency guard: return early when work was already applied.
  if (existingSession.status === 'expired') {
    // Return the resulting value to the caller.
    return { action: 'create' };
  }

  // Idempotency guard: return early when work was already applied.
  if (existingSession.status === 'open') {
    // Same amount: reuse URL so the guest continues the same Checkout session.
    if (existingSession.amount_total === expectedAmountCents(pricing)) {
      // Return the resulting value to the caller.
      return { action: 'reuse', session: existingSession };
    }

    // Price changed: expire old session before creating a new one.
    const expired = await confirmPreviousSessionExpired(previousStripeSessionId, context);
    // Hold-expiry / timing branch.
    if (expired.paid) {
      // Return the resulting value to the caller.
      return { action: 'paid', sessionId: previousStripeSessionId };
    }
    // Guard: early-return or throw when required input is missing/invalid.
    if (!expired.ok) {
      // Return the resulting value to the caller.
      return { action: 'refuse' };
    }
    // Return the resulting value to the caller.
    return { action: 'create' };
  }

  // Return the resulting value to the caller.
  return { action: 'refuse' };
}

/**
 * Reserve a checkout attempt number, create Stripe session with idempotency key,
 * then link it. On link failure, expire the orphan session and bump attempt.
 */
async function createAndLinkStripeSession({
  // Contribute this line to the enclosing declaration or statement.
  req,
  // Contribute this line to the enclosing declaration or statement.
  car,
  // Contribute this line to the enclosing declaration or statement.
  formData,
  // Contribute this line to the enclosing declaration or statement.
  pricing,
  // Contribute this line to the enclosing declaration or statement.
  reservationDoc,
  // Contribute this line to the enclosing declaration or statement.
  createdReservationThisStep,
// Continue the surrounding logic with this statement.
}) {
  // Reserve the attempt variable for later assignment.
  let attempt;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in attempt.
    attempt = await reservationSql.reserveCheckoutAttempt(reservationDoc.id);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logEvent.warn to perform this step.
    logEvent.warn('checkout.failed', {
      // Provide the request id field value.
      requestId: req.requestId,
      // Provide the reason field value.
      reason: 'checkout_attempt_reserve_failed',
      // Provide the reservation id field value.
      reservationId: reservationDoc?.id?.toString?.(),
      // Provide the message field value.
      message: err.message,
    });
    // Return the resulting value to the caller.
    return checkoutErrorResponse(car, formData, pricing);
  }

  // attempt is part of the key so intentional recreates get a new Stripe session.
  const idempotencyKey = buildCheckoutIdempotencyKey(reservationDoc.id, attempt);

  // Reserve the stripe session variable for later assignment.
  let stripeSession;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in stripeSession.
    stripeSession = await createStripeCheckoutSession({
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      pricing,
      // Provide the reservation id field value.
      reservationId: reservationDoc.id,
      // Provide the car id field value.
      carId: car.id,
      // Provide the session id field value.
      sessionId: getSessionId(req),
      // Contribute this line to the enclosing declaration or statement.
      idempotencyKey,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logEvent.warn to perform this step.
    logEvent.warn('checkout.failed', {
      // Provide the request id field value.
      requestId: req.requestId,
      // Provide the reason field value.
      reason: 'stripe_session_creation_failed',
      // Provide the reservation id field value.
      reservationId: reservationDoc?.id?.toString?.(),
      // Provide the car id field value.
      carId: car?.id?.toString?.(),
      // Provide the message field value.
      message: err.message,
    });

    // Call trackPaymentFailure to perform this step.
    trackPaymentFailure('stripe_session_creation_failed', {
      // Provide the request id field value.
      requestId: req.requestId,
      // Provide the car id field value.
      carId: car?.id?.toString?.(),
      // Provide the reservation id field value.
      reservationId: reservationDoc?.id?.toString?.(),
      // Provide the message field value.
      message: err.message,
    });

    // Wait until the asynchronous operation resolves.
    await compensateReservationAfterStripeFailure(
      // Contribute this line to the enclosing declaration or statement.
      reservationDoc,
      // Reference the identifier used by the enclosing expression.
      createdReservationThisStep
    );

    // Return the resulting value to the caller.
    return checkoutErrorResponse(car, formData, pricing);
  }

  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in reservationDoc.
    reservationDoc = await linkStripeSessionToReservation({
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Contribute this line to the enclosing declaration or statement.
      reservationDoc,
      // Provide the stripe session id field value.
      stripeSessionId: stripeSession.id,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Initialize the mutable stripe expire failed variable.
    let stripeExpireFailed = false;

    // Session exists at Stripe but is not linked — expire to avoid orphan paid risk.
    try {
      // Wait until the asynchronous operation resolves.
      await expireStripeCheckoutSession(stripeSession.id);
    // Continue the surrounding logic with this statement.
    } catch (expireErr) {
      // Update stripeExpireFailed with the right-hand side value.
      stripeExpireFailed = true;
      // Call logger.error to perform this step.
      logger.error(
        {
          // Provide the err field value.
          err: expireErr,
          // Provide the original err field value.
          originalErr: err,
          // Provide the stripe session id field value.
          stripeSessionId: stripeSession.id,
          // Provide the reservation id field value.
          reservationId: reservationDoc?.id?.toString?.(),
          // Provide the correlation id field value.
          correlationId: req.correlationId,
        },
        // Supply the literal value used by the enclosing expression.
        'Failed to expire orphan Stripe checkout session after reservation update failure'
      );
    }

    // Stripe / payment-related branch.
    if (!stripeExpireFailed) {
      // Bump attempt so the next create does not reuse the expired session's idempotency key.
      try {
        // Wait until the asynchronous operation resolves.
        await reservationSql.reserveCheckoutAttempt(reservationDoc.id, {
          // Provide the force increment field value.
          forceIncrement: true,
        });
      // Continue the surrounding logic with this statement.
      } catch (bumpErr) {
        // Call logger.error to perform this step.
        logger.error(
          {
            // Provide the err field value.
            err: bumpErr,
            // Provide the original err field value.
            originalErr: err,
            // Provide the stripe session id field value.
            stripeSessionId: stripeSession.id,
            // Provide the reservation id field value.
            reservationId: reservationDoc?.id?.toString?.(),
            // Provide the correlation id field value.
            correlationId: req.correlationId,
          },
          // Supply the literal value used by the enclosing expression.
          'Failed to bump checkout attempt after expiring orphan Stripe session'
        );
      }
    }

    // Call logEvent.warn to perform this step.
    logEvent.warn('checkout.failed', {
      // Provide the request id field value.
      requestId: req.requestId,
      // Provide the reason field value.
      reason: 'reservation_stripe_session_link_failed',
      // Provide the reservation id field value.
      reservationId: reservationDoc?.id?.toString?.(),
      // Provide the stripe session id field value.
      stripeSessionId: stripeSession.id,
      // Provide the message field value.
      message: err.message,
    });

    // Call trackPaymentFailure to perform this step.
    trackPaymentFailure('reservation_stripe_session_link_failed', {
      // Provide the request id field value.
      requestId: req.requestId,
      // Provide the car id field value.
      carId: car?.id?.toString?.(),
      // Provide the reservation id field value.
      reservationId: reservationDoc?.id?.toString?.(),
      // Provide the stripe session id field value.
      stripeSessionId: stripeSession.id,
      // Provide the message field value.
      message: err.message,
      // Provide the stripe expire attempted field value.
      stripeExpireAttempted: true,
      // Contribute this line to the enclosing declaration or statement.
      stripeExpireFailed,
    });

    // Return the resulting value to the caller.
    return checkoutErrorResponse(car, formData, pricing);
  }

  // Wait until the asynchronous operation resolves.
  await logCustomerAction(req, {
    // Provide the action field value.
    action: 'customer.started_checkout',
    // Provide the entity type field value.
    entityType: 'reservation',
    // Provide the entity id field value.
    entityId: reservationDoc.id,
    // Provide the metadata field value.
    metadata: {
      // Provide the stripe session id field value.
      stripeSessionId: stripeSession.id,
      // Provide the car id field value.
      carId: car.id,
      // Provide the created reservation this step field value.
      createdReservationThisStep: Boolean(createdReservationThisStep),
      // Provide the checkout attempt field value.
      checkoutAttempt: attempt,
    },
  });

  // Return the resulting value to the caller.
  return buildRedirectResponse(stripeSession.url);
}

/**
 * Inside the checkout lock: reuse open session, refuse unsafe states, or create new.
 */
async function createOrReuseLockedCheckoutSession({
  // Contribute this line to the enclosing declaration or statement.
  req,
  // Contribute this line to the enclosing declaration or statement.
  car,
  // Contribute this line to the enclosing declaration or statement.
  formData,
  // Contribute this line to the enclosing declaration or statement.
  pricing,
  // Contribute this line to the enclosing declaration or statement.
  reservationDoc,
  // Contribute this line to the enclosing declaration or statement.
  createdReservationThisStep,
// Continue the surrounding logic with this statement.
}) {
  // Stripe / payment-related branch.
  if (!canLinkNewStripeSession(reservationDoc)) {
    // Return the resulting value to the caller.
    return checkoutErrorResponse(car, formData, pricing);
  }

  // Create the existing constant.
  const existing = await resolveExistingCheckoutSession({
    // Contribute this line to the enclosing declaration or statement.
    reservationDoc,
    // Contribute this line to the enclosing declaration or statement.
    pricing,
    // Contribute this line to the enclosing declaration or statement.
    req,
    // Contribute this line to the enclosing declaration or statement.
    car,
  });

  // Idempotency guard: return early when work was already applied.
  if (existing.action === 'paid') {
    // Call trackPaymentFailure to perform this step.
    trackPaymentFailure('superseded_stripe_session_already_paid', {
      // Provide the correlation id field value.
      correlationId: req.correlationId,
      // Provide the reservation id field value.
      reservationId: reservationDoc?.id?.toString?.(),
      // Provide the stripe session id field value.
      stripeSessionId: existing.sessionId,
    });
    // Return the resulting value to the caller.
    return paymentReviewResponse(car, formData, pricing);
  }

  // Idempotency guard: return early when work was already applied.
  if (existing.action === 'refuse') {
    // Return the resulting value to the caller.
    return checkoutErrorResponse(car, formData, pricing);
  }

  // Idempotency guard: return early when work was already applied.
  if (existing.action === 'reuse') {
    // Protected block: isolate failure modes.
    try {
      // Store the awaited result in reservationDoc.
      reservationDoc = await linkStripeSessionToReservation({
        // Contribute this line to the enclosing declaration or statement.
        req,
        // Contribute this line to the enclosing declaration or statement.
        reservationDoc,
        // Provide the stripe session id field value.
        stripeSessionId: existing.session.id,
      });
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call logEvent.warn to perform this step.
      logEvent.warn('checkout.failed', {
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the reason field value.
        reason: 'reservation_stripe_session_link_failed',
        // Provide the reservation id field value.
        reservationId: reservationDoc?.id?.toString?.(),
        // Provide the stripe session id field value.
        stripeSessionId: existing.session.id,
        // Provide the message field value.
        message: err.message,
      });
      // Return the resulting value to the caller.
      return checkoutErrorResponse(car, formData, pricing);
    }

    // Wait until the asynchronous operation resolves.
    await logCustomerAction(req, {
      // Provide the action field value.
      action: 'customer.started_checkout',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: reservationDoc.id,
      // Provide the metadata field value.
      metadata: {
        // Provide the stripe session id field value.
        stripeSessionId: existing.session.id,
        // Provide the car id field value.
        carId: car.id,
        // Provide the created reservation this step field value.
        createdReservationThisStep: Boolean(createdReservationThisStep),
        // Provide the reused existing session field value.
        reusedExistingSession: true,
      },
    });

    // Return the resulting value to the caller.
    return buildRedirectResponse(existing.session.url);
  }

  // Return the resulting value to the caller.
  return createAndLinkStripeSession({
    // Contribute this line to the enclosing declaration or statement.
    req,
    // Contribute this line to the enclosing declaration or statement.
    car,
    // Contribute this line to the enclosing declaration or statement.
    formData,
    // Contribute this line to the enclosing declaration or statement.
    pricing,
    // Contribute this line to the enclosing declaration or statement.
    reservationDoc,
    // Contribute this line to the enclosing declaration or statement.
    createdReservationThisStep,
  });
}

/**
 * Public entry: validate → price → hold → lock → create/reuse Stripe Checkout.
 *
 * @param {import('express').Request} req
 * @returns {Promise<object>} renderOrderPage or redirect response
 */
async function createCheckoutSessionFlow(req) {
  // Create the form data constant.
  const formData = { ...req.body, releaseRedirect: req.originalUrl };

  // Create the car constant.
  const car = await carRepository.findById(formData.carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    // Throw an error to stop the current control flow.
    throw new NotFoundError('Car not found.');
  }

  // Create the validation constant.
  const validation = validateCheckoutRequest(req, car, formData);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!validation.ok) {
    // Return the resulting value to the caller.
    return validation.response;
  }

  // Destructure object properties into local variables.
  const { startDate, endDate } = validation;

  // Create the pricing result constant.
  const pricingResult = await resolveCheckoutPricing(car, formData, startDate, endDate);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!pricingResult.ok) {
    // Return the resulting value to the caller.
    return pricingResult.response;
  }

  // Destructure object properties into local variables.
  const { pricing } = pricingResult;

  // Create the reservation result constant.
  const reservationResult = await resolveCheckoutReservation({
    // Contribute this line to the enclosing declaration or statement.
    req,
    // Contribute this line to the enclosing declaration or statement.
    car,
    // Contribute this line to the enclosing declaration or statement.
    formData,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
    // Contribute this line to the enclosing declaration or statement.
    pricing,
  });
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservationResult.ok) {
    // Return the resulting value to the caller.
    return reservationResult.response;
  }

  // Destructure object properties into local variables.
  const { createdReservationThisStep } = reservationResult;
  // Destructure object properties into local variables.
  let { reservationDoc } = reservationResult;

  // Call logEvent.info to perform this step.
  logEvent.info('checkout.started', {
    // Provide the request id field value.
    requestId: req.requestId,
    // Provide the reservation id field value.
    reservationId: reservationDoc?.id?.toString?.(),
    // Provide the car id field value.
    carId: car?.id?.toString?.(),
  });
  // Call metrics.incrementCheckoutStarted to perform this step.
  metrics.incrementCheckoutStarted();

  // Stripe / payment-related branch.
  if (!canLinkNewStripeSession(reservationDoc)) {
    // Return the resulting value to the caller.
    return checkoutErrorResponse(car, formData, pricing);
  }

  // Protected block: isolate failure modes.
  try {
    // Serialize concurrent checkout starts for the same reservation.
    return await withReservationCheckoutLock(reservationDoc.id, async () => {
      // Create the locked constant.
      const locked = await reservationRepository.findById(reservationDoc.id);
      // Evaluate the condition and enter the branch when it is true.
      if (!locked) {
        // Return the resulting value to the caller.
        return checkoutErrorResponse(car, formData, pricing);
      }

      // Return the resulting value to the caller.
      return createOrReuseLockedCheckoutSession({
        // Contribute this line to the enclosing declaration or statement.
        req,
        // Contribute this line to the enclosing declaration or statement.
        car,
        // Contribute this line to the enclosing declaration or statement.
        formData,
        // Contribute this line to the enclosing declaration or statement.
        pricing,
        // Provide the reservation doc field value.
        reservationDoc: locked,
        // Contribute this line to the enclosing declaration or statement.
        createdReservationThisStep,
      });
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Stripe / payment-related branch.
    if (isCheckoutLockBusyError(err)) {
      // Return the resulting value to the caller.
      return checkoutErrorResponse(car, formData, pricing);
    }
    // Throw an error to stop the current control flow.
    throw err;
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createCheckoutSessionFlow,
};
