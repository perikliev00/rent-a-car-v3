/**
 * Stripe webhook entrypoint: verify signature, route refund events to the refund
 * inbox, and route checkout.session.completed to booking finalization.
 * Always acknowledges with HTTP 200 for processed events so Stripe does not retry
 * endlessly for business outcomes that require manual review.
 */
const stripe = require('../../config/stripe');
const logger = require('../../utils/logger');
const logEvent = require('../../monitoring/logEvent');
const { trackWebhookFailure } = require('../../monitoring/track');
const { processStripeWebhookEvent } = require('../bookingFinalizationService');
const { handleRefundWebhookEvent } = require('./refund/refundWebhookInbox');

/**
 * Handle an inbound Stripe webhook HTTP request.
 *
 * @param {import('express').Request} req - Raw body + stripe-signature header required
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function handleStripeWebhookFlow(req) {
  const logPrefix = '🌐 [StripeWebhook]';
  const sig = req.headers['stripe-signature'];
  let event;

  logger.info(
    { requestId: req.requestId, method: req.method, path: req.originalUrl },
    `${logPrefix} webhook received`
  );

  // Protected block: isolate failure modes.
  try {
    // Reject forged payloads; Stripe signature verification is the trust boundary.
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

  // Refund lifecycle is handled separately from checkout finalization.
  if (
    event.type === 'charge.refunded' ||
    event.type === 'refund.updated' ||
    event.type === 'refund.created' ||
    event.type === 'refund.failed'
  ) {
    return handleRefundWebhookEvent(event, req);
  }

  // Stripe / payment-related branch.
  if (event.type === 'checkout.session.completed') {
    const session = event.data && event.data.object;
    // Guard: early-return or throw when required input is missing/invalid.
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

    // Status / lifecycle guard before mutating domain state.
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

    // Paid but overlapping dates — ack 200 so Stripe stops retrying; ops handle manually.
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

    // Idempotent delivery: same eventId already processed.
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

    // Guard: early-return or throw when required input is missing/invalid.
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

    // Status / lifecycle guard before mutating domain state.
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
