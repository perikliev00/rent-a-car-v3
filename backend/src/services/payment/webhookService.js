const stripe = require('../../config/stripe');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const { trackWebhookFailure } = require('../../monitoring/track');
const paymentEventSql = require('../sql/paymentEventSqlService');
const { processStripeWebhookEvent } = require('../bookingFinalizationService');
const {
  applyRefundFromStripeObject,
} = require('./refund/reservationRefundService');

async function handleRefundWebhookEvent(event, req) {
  const obj = event.data?.object;
  if (!obj) {
    return { statusCode: 200, body: { received: true } };
  }

  try {
    await applyRefundFromStripeObject(obj, { eventType: event.type });
  } catch (err) {
    logger.error(
      { err, eventId: event.id, eventType: event.type, requestId: req.requestId },
      'Failed to apply Stripe refund webhook'
    );
    trackWebhookFailure('refund_apply_failed', {
      requestId: req.requestId,
      eventId: event.id,
      eventType: event.type,
      message: err.message,
    });
  }

  return { statusCode: 200, body: { received: true } };
}

async function handleStripeWebhookFlow(req) {
  const logPrefix = '🌐 [StripeWebhook]';
  const sig = req.headers['stripe-signature'];
  let event;

  logger.info(
    { requestId: req.requestId, method: req.method, path: req.originalUrl },
    `${logPrefix} webhook received`
  );

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    trackWebhookFailure('signature_verification_failed', {
      requestId: req.requestId,
      message: err.message,
    });
    return {
      statusCode: 400,
      body: { received: false },
    };
  }

  logEvent.info('stripe.webhook.received', {
    requestId: req.requestId,
    eventType: event.type,
    eventId: event.id,
  });

  logger.info(
    { requestId: req.requestId, eventType: event.type, eventId: event.id },
    `${logPrefix} parsed event`
  );

  paymentEventSql
    .insertPaymentEvent({
      eventId: event.id,
      eventType: event.type,
      stripeSessionId: event.data?.object?.id || null,
      reservationId:
        event.data?.object?.metadata?.reservationId ||
        event.data?.object?.client_reference_id ||
        null,
      status: 'received',
    })
    .catch((err) => {
      logger.error({ err, eventId: event.id }, 'Failed to persist payment event');
    });

  if (event.type === 'charge.refunded' || event.type === 'refund.updated') {
    return handleRefundWebhookEvent(event, req);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data && event.data.object;
    if (!session || !session.id) {
      trackWebhookFailure('missing_session_id', {
        requestId: req.requestId,
        eventId: event.id,
      });
      return {
        statusCode: 200,
        body: { received: true },
      };
    }

    const stripeSessionId = session.id;
    const sessionMetadata = session.metadata || {};

    const result = await processStripeWebhookEvent({
      eventId: event.id,
      stripeSessionId,
      reservationId: sessionMetadata.reservationId || session.client_reference_id || null,
      carId: sessionMetadata.carId || null,
      sessionId: sessionMetadata.sessionId || null,
      stripeSessionPaymentStatus: session.payment_status || null,
      stripeSessionAmountTotal: session.amount_total ?? null,
      stripeSessionCurrency: session.currency || null,
      stripePaymentIntent:
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id || null,
      logPrefix: `${logPrefix}[${req.requestId}]`,
    });

    if (session.payment_status === 'paid') {
      logEvent.info('stripe.payment.succeeded', {
        requestId: req.requestId,
        eventId: event.id,
        stripeSessionId,
        reservationId: sessionMetadata.reservationId || session.client_reference_id || null,
      });
    } else if (session.payment_status && session.payment_status !== 'paid') {
      logEvent.warn('stripe.payment.failed', {
        requestId: req.requestId,
        eventId: event.id,
        stripeSessionId,
        paymentStatus: session.payment_status,
      });
    }

    if (result?.reason === 'overlap_after_payment') {
      logger.error(
        {
          requestId: req.requestId,
          eventId: event.id,
          stripeSessionId,
          reservationId: result.reservation?.id?.toString?.(),
          reason: 'overlap_after_payment',
        },
        `${logPrefix} paid booking overlap requires manual review`
      );
      return {
        statusCode: 200,
        body: { received: true },
      };
    }

    if (result?.reason === 'duplicate_event') {
      logger.info(
        { requestId: req.requestId, eventId: event.id },
        `${logPrefix} duplicate event skipped`
      );
      return {
        statusCode: 200,
        body: { received: true },
      };
    }

    if (!result?.found) {
      trackWebhookFailure('reservation_not_found', {
        requestId: req.requestId,
        stripeSessionId,
        eventId: event.id,
      });
      return {
        statusCode: 200,
        body: { received: true },
      };
    }

    if (result.reason === 'status_not_active' && result.reservation) {
      trackWebhookFailure('reservation_not_active', {
        requestId: req.requestId,
        reservationId: result.reservation.id?.toString?.(),
        status: result.reservation.status,
        stripeSessionId,
      });
      return {
        statusCode: 200,
        body: { received: true },
      };
    }
  }

  return {
    statusCode: 200,
    body: { received: true },
  };
}

module.exports = {
  handleStripeWebhookFlow,
};
