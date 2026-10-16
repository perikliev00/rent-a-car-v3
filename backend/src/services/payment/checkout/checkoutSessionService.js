/**
 * Orchestrates Stripe Checkout session create/reuse for a reservation hold.
 * Uses a per-reservation checkout lock, Stripe idempotency keys, and careful
 * expire/reuse of open sessions so guests do not pay twice or orphan paid sessions.
 */
const carRepository = require('../../../repositories/carRepository');
const reservationRepository = require('../../../repositories/reservationRepository');
const reservationSql = require('../../sql/reservationSqlService');
const { NotFoundError } = require('../../../utils/appError');
const { getSessionId } = require('../../../utils/reservationHelpers');
const { trackPaymentFailure } = require('../../../monitoring/track');
const logEvent = require('../../../monitoring/logEvent');
const metrics = require('../../../monitoring/metrics');
const logger = require('../../../utils/logger');
const { withReservationCheckoutLock, isCheckoutLockBusyError } = require('../../../db/transaction');
const {
  buildCheckoutIdempotencyKey,
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  retrieveStripeCheckoutSession,
  safeExpireSupersededCheckoutSession,
} = require('../stripeCheckoutService');
const { canLinkNewStripeSession } = require('../stripeSessionValidation');
const { validateCheckoutRequest } = require('./checkoutValidationService');
const { resolveCheckoutPricing } = require('./checkoutPricingService');
const { resolveCheckoutReservation } = require('./checkoutReservationService');
const { compensateReservationAfterStripeFailure } = require('./checkoutCompensationService');
const {
  buildRenderOrderPageResponse,
  buildRedirectResponse,
} = require('./checkoutResponseFactory');
const { logCustomerAction } = require('../../admin/adminAuditService');
const { changeStatus } = require('../../reservation/reservationStatusService');

const UNABLE_TO_START_PAYMENT = 'Unable to start payment. Please try again in a minute.';
const PAYMENT_REVIEW_MESSAGE =
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
  return buildRenderOrderPageResponse(car, formData, message, {
    rentalDays: pricing.rentalDays,
    deliveryPrice: pricing.deliveryPrice,
    returnPrice: pricing.returnPrice,
    totalPrice: pricing.totalPrice,
  });
}

/** When a prior session is already paid, ask the guest to wait for review rather than recreate. */
function paymentReviewResponse(car, formData, pricing) {
  return checkoutErrorResponse(car, formData, pricing, PAYMENT_REVIEW_MESSAGE);
}

/**
 * Predicate helper: is paid or complete.
 * @param {object} session
 * @returns {*}
 */
function isPaidOrComplete(session) {
  return session?.payment_status === 'paid' || session?.status === 'complete';
}

/**
 * expected amount cents.
 * @param {*} pricing
 * @returns {*}
 */
function expectedAmountCents(pricing) {
  return Math.round(Number(pricing.totalPrice) * 100);
}

/**
 * Persist the Stripe session id and move reservation to processing_payment.
 */
async function linkStripeSessionToReservation({
  req,
  reservationDoc,
  stripeSessionId,
}) {
  const { reservation: updated } = await changeStatus({
    reservationId: reservationDoc.id,
    newStatus: 'processing_payment',
    reason: 'checkout_started',
    actor: { type: 'customer', req, userId: req?.session?.user?.id },
    patch: { stripeSessionId: stripeSessionId },
  });
  return updated;
}

/**
 * Expire a superseded open session and re-fetch to confirm it is expired (not paid).
 * @returns {Promise<{ ok: boolean, paid?: boolean }>}
 */
async function confirmPreviousSessionExpired(sessionId, context) {
  const expireResult = await safeExpireSupersededCheckoutSession(sessionId, context);

  if (expireResult.paid) {
    return { ok: false, paid: true };
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!expireResult.ok) {
    return { ok: false };
  }

  // Protected block: isolate failure modes.
  try {
    // Double-check: race where payment completed between expire attempt and now.
    const confirmed = await retrieveStripeCheckoutSession(sessionId);
    // Status / lifecycle guard before mutating domain state.
    if (isPaidOrComplete(confirmed)) {
      return { ok: false, paid: true };
    }
    // Status / lifecycle guard before mutating domain state.
    if (confirmed.status !== 'expired') {
      return { ok: false };
    }
    return { ok: true };
  } catch (err) {
    logger.warn(
      { err, sessionId, ...context },
      'Could not confirm superseded Stripe checkout session is expired'
    );
    return { ok: false };
  }
}

/**
 * Decide whether to reuse, recreate, refuse, or treat an existing linked session as paid.
 * @returns {Promise<{ action: 'create'|'reuse'|'refuse'|'paid', session?: object, sessionId?: string }>}
 */
async function resolveExistingCheckoutSession({
  reservationDoc,
  pricing,
  req,
  car,
}) {
  const previousStripeSessionId = reservationDoc.stripeSessionId;
  // Stripe / payment-related branch.
  if (!previousStripeSessionId) {
    return { action: 'create' };
  }

  const context = {
    correlationId: req.correlationId,
    reservationId: reservationDoc?.id?.toString?.(),
    carId: car?.id?.toString?.(),
  };

  let existingSession;
  // Protected block: isolate failure modes.
  try {
    existingSession = await retrieveStripeCheckoutSession(previousStripeSessionId);
  } catch (err) {
    // Unknown session state — refuse create to avoid a second charge path.
    logger.warn(
      { err, sessionId: previousStripeSessionId, ...context },
      'Failed to retrieve existing Stripe checkout session; refusing new create'
    );
    return { action: 'refuse' };
  }

  // Idempotency guard: return early when work was already applied.
  if (isPaidOrComplete(existingSession)) {
    return { action: 'paid', sessionId: previousStripeSessionId };
  }

  // Idempotency guard: return early when work was already applied.
  if (existingSession.status === 'expired') {
    return { action: 'create' };
  }

  // Idempotency guard: return early when work was already applied.
  if (existingSession.status === 'open') {
    // Same amount: reuse URL so the guest continues the same Checkout session.
    if (existingSession.amount_total === expectedAmountCents(pricing)) {
      return { action: 'reuse', session: existingSession };
    }

    // Price changed: expire old session before creating a new one.
    const expired = await confirmPreviousSessionExpired(previousStripeSessionId, context);
    // Hold-expiry / timing branch.
    if (expired.paid) {
      return { action: 'paid', sessionId: previousStripeSessionId };
    }
    // Guard: early-return or throw when required input is missing/invalid.
    if (!expired.ok) {
      return { action: 'refuse' };
    }
    return { action: 'create' };
  }

  return { action: 'refuse' };
}

/**
 * Reserve a checkout attempt number, create Stripe session with idempotency key,
 * then link it. On link failure, expire the orphan session and bump attempt.
 */
async function createAndLinkStripeSession({
  req,
  car,
  formData,
  pricing,
  reservationDoc,
  createdReservationThisStep,
}) {
  let attempt;
  // Protected block: isolate failure modes.
  try {
    attempt = await reservationSql.reserveCheckoutAttempt(reservationDoc.id);
  } catch (err) {
    logEvent.warn('checkout.failed', {
      requestId: req.requestId,
      reason: 'checkout_attempt_reserve_failed',
      reservationId: reservationDoc?.id?.toString?.(),
      message: err.message,
    });
    return checkoutErrorResponse(car, formData, pricing);
  }

  // attempt is part of the key so intentional recreates get a new Stripe session.
  const idempotencyKey = buildCheckoutIdempotencyKey(reservationDoc.id, attempt);

  let stripeSession;
  // Protected block: isolate failure modes.
  try {
    stripeSession = await createStripeCheckoutSession({
      car,
      pricing,
      reservationId: reservationDoc.id,
      carId: car.id,
      sessionId: getSessionId(req),
      idempotencyKey,
    });
  } catch (err) {
    logEvent.warn('checkout.failed', {
      requestId: req.requestId,
      reason: 'stripe_session_creation_failed',
      reservationId: reservationDoc?.id?.toString?.(),
      carId: car?.id?.toString?.(),
      message: err.message,
    });

    trackPaymentFailure('stripe_session_creation_failed', {
      requestId: req.requestId,
      carId: car?.id?.toString?.(),
      reservationId: reservationDoc?.id?.toString?.(),
      message: err.message,
    });

    await compensateReservationAfterStripeFailure(
      reservationDoc,
      createdReservationThisStep
    );

    return checkoutErrorResponse(car, formData, pricing);
  }

  // Protected block: isolate failure modes.
  try {
    reservationDoc = await linkStripeSessionToReservation({
      req,
      reservationDoc,
      stripeSessionId: stripeSession.id,
    });
  } catch (err) {
    let stripeExpireFailed = false;

    // Session exists at Stripe but is not linked — expire to avoid orphan paid risk.
    try {
      await expireStripeCheckoutSession(stripeSession.id);
    } catch (expireErr) {
      stripeExpireFailed = true;
      logger.error(
        {
          err: expireErr,
          originalErr: err,
          stripeSessionId: stripeSession.id,
          reservationId: reservationDoc?.id?.toString?.(),
          correlationId: req.correlationId,
        },
        'Failed to expire orphan Stripe checkout session after reservation update failure'
      );
    }

    // Stripe / payment-related branch.
    if (!stripeExpireFailed) {
      // Bump attempt so the next create does not reuse the expired session's idempotency key.
      try {
        await reservationSql.reserveCheckoutAttempt(reservationDoc.id, {
          forceIncrement: true,
        });
      } catch (bumpErr) {
        logger.error(
          {
            err: bumpErr,
            originalErr: err,
            stripeSessionId: stripeSession.id,
            reservationId: reservationDoc?.id?.toString?.(),
            correlationId: req.correlationId,
          },
          'Failed to bump checkout attempt after expiring orphan Stripe session'
        );
      }
    }

    logEvent.warn('checkout.failed', {
      requestId: req.requestId,
      reason: 'reservation_stripe_session_link_failed',
      reservationId: reservationDoc?.id?.toString?.(),
      stripeSessionId: stripeSession.id,
      message: err.message,
    });

    trackPaymentFailure('reservation_stripe_session_link_failed', {
      requestId: req.requestId,
      carId: car?.id?.toString?.(),
      reservationId: reservationDoc?.id?.toString?.(),
      stripeSessionId: stripeSession.id,
      message: err.message,
      stripeExpireAttempted: true,
      stripeExpireFailed,
    });

    return checkoutErrorResponse(car, formData, pricing);
  }

  await logCustomerAction(req, {
    action: 'customer.started_checkout',
    entityType: 'reservation',
    entityId: reservationDoc.id,
    metadata: {
      stripeSessionId: stripeSession.id,
      carId: car.id,
      createdReservationThisStep: Boolean(createdReservationThisStep),
      checkoutAttempt: attempt,
    },
  });

  return buildRedirectResponse(stripeSession.url);
}

/**
 * Inside the checkout lock: reuse open session, refuse unsafe states, or create new.
 */
async function createOrReuseLockedCheckoutSession({
  req,
  car,
  formData,
  pricing,
  reservationDoc,
  createdReservationThisStep,
}) {
  // Stripe / payment-related branch.
  if (!canLinkNewStripeSession(reservationDoc)) {
    return checkoutErrorResponse(car, formData, pricing);
  }

  const existing = await resolveExistingCheckoutSession({
    reservationDoc,
    pricing,
    req,
    car,
  });

  // Idempotency guard: return early when work was already applied.
  if (existing.action === 'paid') {
    trackPaymentFailure('superseded_stripe_session_already_paid', {
      correlationId: req.correlationId,
      reservationId: reservationDoc?.id?.toString?.(),
      stripeSessionId: existing.sessionId,
    });
    return paymentReviewResponse(car, formData, pricing);
  }

  // Idempotency guard: return early when work was already applied.
  if (existing.action === 'refuse') {
    return checkoutErrorResponse(car, formData, pricing);
  }

  // Idempotency guard: return early when work was already applied.
  if (existing.action === 'reuse') {
    // Protected block: isolate failure modes.
    try {
      reservationDoc = await linkStripeSessionToReservation({
        req,
        reservationDoc,
        stripeSessionId: existing.session.id,
      });
    } catch (err) {
      logEvent.warn('checkout.failed', {
        requestId: req.requestId,
        reason: 'reservation_stripe_session_link_failed',
        reservationId: reservationDoc?.id?.toString?.(),
        stripeSessionId: existing.session.id,
        message: err.message,
      });
      return checkoutErrorResponse(car, formData, pricing);
    }

    await logCustomerAction(req, {
      action: 'customer.started_checkout',
      entityType: 'reservation',
      entityId: reservationDoc.id,
      metadata: {
        stripeSessionId: existing.session.id,
        carId: car.id,
        createdReservationThisStep: Boolean(createdReservationThisStep),
        reusedExistingSession: true,
      },
    });

    return buildRedirectResponse(existing.session.url);
  }

  return createAndLinkStripeSession({
    req,
    car,
    formData,
    pricing,
    reservationDoc,
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
  const formData = { ...req.body, releaseRedirect: req.originalUrl };

  const car = await carRepository.findById(formData.carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    throw new NotFoundError('Car not found.');
  }

  const validation = validateCheckoutRequest(req, car, formData);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!validation.ok) {
    return validation.response;
  }

  const { startDate, endDate } = validation;

  const pricingResult = await resolveCheckoutPricing(car, formData, startDate, endDate);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!pricingResult.ok) {
    return pricingResult.response;
  }

  const { pricing } = pricingResult;

  const reservationResult = await resolveCheckoutReservation({
    req,
    car,
    formData,
    startDate,
    endDate,
    pricing,
  });
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservationResult.ok) {
    return reservationResult.response;
  }

  const { createdReservationThisStep } = reservationResult;
  let { reservationDoc } = reservationResult;

  logEvent.info('checkout.started', {
    requestId: req.requestId,
    reservationId: reservationDoc?.id?.toString?.(),
    carId: car?.id?.toString?.(),
  });
  metrics.incrementCheckoutStarted();

  // Stripe / payment-related branch.
  if (!canLinkNewStripeSession(reservationDoc)) {
    return checkoutErrorResponse(car, formData, pricing);
  }

  // Protected block: isolate failure modes.
  try {
    // Serialize concurrent checkout starts for the same reservation.
    return await withReservationCheckoutLock(reservationDoc.id, async () => {
      const locked = await reservationRepository.findById(reservationDoc.id);
      if (!locked) {
        return checkoutErrorResponse(car, formData, pricing);
      }

      return createOrReuseLockedCheckoutSession({
        req,
        car,
        formData,
        pricing,
        reservationDoc: locked,
        createdReservationThisStep,
      });
    });
  } catch (err) {
    // Stripe / payment-related branch.
    if (isCheckoutLockBusyError(err)) {
      return checkoutErrorResponse(car, formData, pricing);
    }
    throw err;
  }
}

module.exports = {
  createCheckoutSessionFlow,
};
