const carRepository = require('../../../repositories/carRepository');
const { NotFoundError } = require('../../../utils/appError');
const { getSessionId } = require('../../../utils/reservationHelpers');
const { trackPaymentFailure } = require('../../../monitoring/track');
const logEvent = require('../../../monitoring/logEvent');
const metrics = require('../../../monitoring/metrics');
const logger = require('../../../utils/logger');
const {
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
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
    return buildRenderOrderPageResponse(
      car,
      formData,
      'Unable to start payment. Please try again in a minute.',
      {
        rentalDays: pricing.rentalDays,
        deliveryPrice: pricing.deliveryPrice,
        returnPrice: pricing.returnPrice,
        totalPrice: pricing.totalPrice,
      }
    );
  }

  const previousStripeSessionId = reservationDoc.stripeSessionId;
  if (previousStripeSessionId) {
    const expireResult = await safeExpireSupersededCheckoutSession(previousStripeSessionId, {
      correlationId: req.correlationId,
      reservationId: reservationDoc?.id?.toString?.(),
      carId: car?.id?.toString?.(),
    });

    if (expireResult.paid) {
      trackPaymentFailure('superseded_stripe_session_already_paid', {
        correlationId: req.correlationId,
        reservationId: reservationDoc?.id?.toString?.(),
        stripeSessionId: previousStripeSessionId,
      });

      return buildRenderOrderPageResponse(
        car,
        formData,
        'Your payment is being reviewed. Please contact support if you need help.',
        {
          rentalDays: pricing.rentalDays,
          deliveryPrice: pricing.deliveryPrice,
          returnPrice: pricing.returnPrice,
          totalPrice: pricing.totalPrice,
        }
      );
    }
  }

  let stripeSession;
  try {
    stripeSession = await createStripeCheckoutSession({
      car,
      pricing,
      reservationId: reservationDoc.id,
      carId: car.id,
      sessionId: getSessionId(req),
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

    return buildRenderOrderPageResponse(
      car,
      formData,
      'Unable to start payment. Please try again in a minute.',
      {
        rentalDays: pricing.rentalDays,
        deliveryPrice: pricing.deliveryPrice,
        returnPrice: pricing.returnPrice,
        totalPrice: pricing.totalPrice,
      }
    );
  }

  reservationDoc.stripeSessionId = stripeSession.id;

  try {
    const { reservation: updated } = await changeStatus({
      reservationId: reservationDoc.id,
      newStatus: 'processing_payment',
      reason: 'checkout_started',
      actor: { type: 'customer', req, userId: req?.session?.user?.id },
      patch: { stripeSessionId: stripeSession.id },
    });
    reservationDoc = updated;
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

    return buildRenderOrderPageResponse(
      car,
      formData,
      'Unable to start payment. Please try again in a minute.',
      {
        rentalDays: pricing.rentalDays,
        deliveryPrice: pricing.deliveryPrice,
        returnPrice: pricing.returnPrice,
        totalPrice: pricing.totalPrice,
      }
    );
  }

  await logCustomerAction(req, {
    action: 'customer.started_checkout',
    entityType: 'reservation',
    entityId: reservationDoc.id,
    metadata: {
      stripeSessionId: stripeSession.id,
      carId: car.id,
      createdReservationThisStep: Boolean(createdReservationThisStep),
    },
  });

  return buildRedirectResponse(stripeSession.url);
}

module.exports = {
  createCheckoutSessionFlow,
};
