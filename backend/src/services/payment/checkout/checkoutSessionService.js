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

function checkoutErrorResponse(car, formData, pricing, message = UNABLE_TO_START_PAYMENT) {
  return buildRenderOrderPageResponse(car, formData, message, {
    rentalDays: pricing.rentalDays,
    deliveryPrice: pricing.deliveryPrice,
    returnPrice: pricing.returnPrice,
    totalPrice: pricing.totalPrice,
  });
}

function paymentReviewResponse(car, formData, pricing) {
  return checkoutErrorResponse(car, formData, pricing, PAYMENT_REVIEW_MESSAGE);
}

function isPaidOrComplete(session) {
  return session?.payment_status === 'paid' || session?.status === 'complete';
}

function expectedAmountCents(pricing) {
  return Math.round(Number(pricing.totalPrice) * 100);
}

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

async function confirmPreviousSessionExpired(sessionId, context) {
  const expireResult = await safeExpireSupersededCheckoutSession(sessionId, context);

  if (expireResult.paid) {
    return { ok: false, paid: true };
  }

  if (!expireResult.ok) {
    return { ok: false };
  }

  try {
    const confirmed = await retrieveStripeCheckoutSession(sessionId);
    if (isPaidOrComplete(confirmed)) {
      return { ok: false, paid: true };
    }
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

async function resolveExistingCheckoutSession({
  reservationDoc,
  pricing,
  req,
  car,
}) {
  const previousStripeSessionId = reservationDoc.stripeSessionId;
  if (!previousStripeSessionId) {
    return { action: 'create' };
  }

  const context = {
    correlationId: req.correlationId,
    reservationId: reservationDoc?.id?.toString?.(),
    carId: car?.id?.toString?.(),
  };

  let existingSession;
  try {
    existingSession = await retrieveStripeCheckoutSession(previousStripeSessionId);
  } catch (err) {
    logger.warn(
      { err, sessionId: previousStripeSessionId, ...context },
      'Failed to retrieve existing Stripe checkout session; refusing new create'
    );
    return { action: 'refuse' };
  }

  if (isPaidOrComplete(existingSession)) {
    return { action: 'paid', sessionId: previousStripeSessionId };
  }

  if (existingSession.status === 'expired') {
    return { action: 'create' };
  }

  if (existingSession.status === 'open') {
    if (existingSession.amount_total === expectedAmountCents(pricing)) {
      return { action: 'reuse', session: existingSession };
    }

    const expired = await confirmPreviousSessionExpired(previousStripeSessionId, context);
    if (expired.paid) {
      return { action: 'paid', sessionId: previousStripeSessionId };
    }
    if (!expired.ok) {
      return { action: 'refuse' };
    }
    return { action: 'create' };
  }

  return { action: 'refuse' };
}

async function createAndLinkStripeSession({
  req,
  car,
  formData,
  pricing,
  reservationDoc,
  createdReservationThisStep,
}) {
  let attempt;
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

  const idempotencyKey = buildCheckoutIdempotencyKey(reservationDoc.id, attempt);

  let stripeSession;
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

  try {
    reservationDoc = await linkStripeSessionToReservation({
      req,
      reservationDoc,
      stripeSessionId: stripeSession.id,
    });
  } catch (err) {
    let stripeExpireFailed = false;

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

    if (!stripeExpireFailed) {
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

async function createOrReuseLockedCheckoutSession({
  req,
  car,
  formData,
  pricing,
  reservationDoc,
  createdReservationThisStep,
}) {
  if (!canLinkNewStripeSession(reservationDoc)) {
    return checkoutErrorResponse(car, formData, pricing);
  }

  const existing = await resolveExistingCheckoutSession({
    reservationDoc,
    pricing,
    req,
    car,
  });

  if (existing.action === 'paid') {
    trackPaymentFailure('superseded_stripe_session_already_paid', {
      correlationId: req.correlationId,
      reservationId: reservationDoc?.id?.toString?.(),
      stripeSessionId: existing.sessionId,
    });
    return paymentReviewResponse(car, formData, pricing);
  }

  if (existing.action === 'refuse') {
    return checkoutErrorResponse(car, formData, pricing);
  }

  if (existing.action === 'reuse') {
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

async function createCheckoutSessionFlow(req) {
  const formData = { ...req.body, releaseRedirect: req.originalUrl };

  const car = await carRepository.findById(formData.carId);
  if (!car) {
    throw new NotFoundError('Car not found.');
  }

  const validation = validateCheckoutRequest(req, car, formData);
  if (!validation.ok) {
    return validation.response;
  }

  const { startDate, endDate } = validation;

  const pricingResult = await resolveCheckoutPricing(car, formData, startDate, endDate);
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

  if (!canLinkNewStripeSession(reservationDoc)) {
    return checkoutErrorResponse(car, formData, pricing);
  }

  try {
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
    if (isCheckoutLockBusyError(err)) {
      return checkoutErrorResponse(car, formData, pricing);
    }
    throw err;
  }
}

module.exports = {
  createCheckoutSessionFlow,
};
