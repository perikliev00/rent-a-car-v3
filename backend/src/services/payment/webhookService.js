/**
 * Stripe webhook entrypoint: verify signature, route refund events to the refund
 * inbox, and route checkout.session.completed to booking finalization.
 * Always acknowledges with HTTP 200 for processed events so Stripe does not retry
 * endlessly for business outcomes that require manual review.
 */
const stripe = require('../../config/stripe');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Require the '../../monitoring/logEvent' module as logEvent.
const logEvent = require('../../monitoring/logEvent');
// Destructure object properties into local variables.
const { trackWebhookFailure } = require('../../monitoring/track');
// Destructure object properties into local variables.
const { processStripeWebhookEvent } = require('../bookingFinalizationService');
// Destructure object properties into local variables.
const { handleRefundWebhookEvent } = require('./refund/refundWebhookInbox');

/**
 * Handle an inbound Stripe webhook HTTP request.
 *
 * @param {import('express').Request} req - Raw body + stripe-signature header required
 * @returns {Promise<{ statusCode: number, body: object }>}
 */
async function handleStripeWebhookFlow(req) {
  // Create the log prefix constant.
  const logPrefix = '🌐 [StripeWebhook]';
  // Create the sig constant.
  const sig = req.headers['stripe-signature'];
  // Reserve the event variable for later assignment.
  let event;

  // Call logger.info to perform this step.
  logger.info(
    // Contribute this line to the enclosing declaration or statement.
    { requestId: req.requestId, method: req.method, path: req.originalUrl },
    // Continue the surrounding logic with this statement.
    `${logPrefix} webhook received`
  );

  // Protected block: isolate failure modes.
  try {
    // Reject forged payloads; Stripe signature verification is the trust boundary.
    event = stripe.webhooks.constructEvent(
      // Contribute this line to the enclosing declaration or statement.
      req.body,
      // Contribute this line to the enclosing declaration or statement.
      sig,
      // Contribute this line to the enclosing declaration or statement.
      process.env.STRIPE_WEBHOOK_SECRET
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call trackWebhookFailure to perform this step.
    trackWebhookFailure('signature_verification_failed', {
      // Provide the request id field value.
      requestId: req.requestId,
      // Provide the message field value.
      message: err.message,
    });
    // Return the resulting value to the caller.
    return {
      // Provide the status code field value.
      statusCode: 400,
      // Provide the body field value.
      body: { received: false },
    };
  }

  // Call logEvent.info to perform this step.
  logEvent.info('stripe.webhook.received', {
    // Provide the request id field value.
    requestId: req.requestId,
    // Provide the event type field value.
    eventType: event.type,
    // Provide the event id field value.
    eventId: event.id,
  });

  // Call logger.info to perform this step.
  logger.info(
    // Contribute this line to the enclosing declaration or statement.
    { requestId: req.requestId, eventType: event.type, eventId: event.id },
    // Continue the surrounding logic with this statement.
    `${logPrefix} parsed event`
  );

  // Refund lifecycle is handled separately from checkout finalization.
  if (
    // Update event.type with the right-hand side value.
    event.type === 'charge.refunded' ||
    // Update event.type with the right-hand side value.
    event.type === 'refund.updated' ||
    // Update event.type with the right-hand side value.
    event.type === 'refund.created' ||
    // Update event.type with the right-hand side value.
    event.type === 'refund.failed'
  // Continue the surrounding logic with this statement.
  ) {
    // Return the resulting value to the caller.
    return handleRefundWebhookEvent(event, req);
  }

  // Stripe / payment-related branch.
  if (event.type === 'checkout.session.completed') {
    // Create the session constant.
    const session = event.data && event.data.object;
    // Guard: early-return or throw when required input is missing/invalid.
    if (!session || !session.id) {
      // Call trackWebhookFailure to perform this step.
      trackWebhookFailure('missing_session_id', {
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the event id field value.
        eventId: event.id,
      });
      // Return the resulting value to the caller.
      return {
        // Provide the status code field value.
        statusCode: 200,
        // Provide the body field value.
        body: { received: true },
      };
    }

    // Create the stripe session id constant.
    const stripeSessionId = session.id;
    // Create the session metadata constant.
    const sessionMetadata = session.metadata || {};

    // Create the result constant.
    const result = await processStripeWebhookEvent({
      // Provide the event id field value.
      eventId: event.id,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Provide the reservation id field value.
      reservationId: sessionMetadata.reservationId || session.client_reference_id || null,
      // Provide the car id field value.
      carId: sessionMetadata.carId || null,
      // Provide the session id field value.
      sessionId: sessionMetadata.sessionId || null,
      // Provide the stripe session payment status field value.
      stripeSessionPaymentStatus: session.payment_status || null,
      // Provide the stripe session amount total field value.
      stripeSessionAmountTotal: session.amount_total ?? null,
      // Provide the stripe session currency field value.
      stripeSessionCurrency: session.currency || null,
      // Provide the stripe payment intent field value.
      stripePaymentIntent:
        // Continue the surrounding logic with this statement.
        typeof session.payment_intent === 'string'
          // Contribute this line to the enclosing declaration or statement.
          ? session.payment_intent
          // Contribute this line to the enclosing declaration or statement.
          : session.payment_intent?.id || null,
      // Provide the log prefix field value.
      logPrefix: `${logPrefix}[${req.requestId}]`,
    });

    // Status / lifecycle guard before mutating domain state.
    if (session.payment_status === 'paid') {
      // Call logEvent.info to perform this step.
      logEvent.info('stripe.payment.succeeded', {
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the event id field value.
        eventId: event.id,
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
        // Provide the reservation id field value.
        reservationId: sessionMetadata.reservationId || session.client_reference_id || null,
      });
    // Continue the surrounding logic with this statement.
    } else if (session.payment_status && session.payment_status !== 'paid') {
      // Call logEvent.warn to perform this step.
      logEvent.warn('stripe.payment.failed', {
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the event id field value.
        eventId: event.id,
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
        // Provide the payment status field value.
        paymentStatus: session.payment_status,
      });
    }

    // Paid but overlapping dates — ack 200 so Stripe stops retrying; ops handle manually.
    if (result?.reason === 'overlap_after_payment') {
      // Call logger.error to perform this step.
      logger.error(
        {
          // Provide the request id field value.
          requestId: req.requestId,
          // Provide the event id field value.
          eventId: event.id,
          // Contribute this line to the enclosing declaration or statement.
          stripeSessionId,
          // Provide the reservation id field value.
          reservationId: result.reservation?.id?.toString?.(),
          // Provide the reason field value.
          reason: 'overlap_after_payment',
        },
        // Continue the surrounding logic with this statement.
        `${logPrefix} paid booking overlap requires manual review`
      );
      // Return the resulting value to the caller.
      return {
        // Provide the status code field value.
        statusCode: 200,
        // Provide the body field value.
        body: { received: true },
      };
    }

    // Idempotent delivery: same eventId already processed.
    if (result?.reason === 'duplicate_event') {
      // Call logger.info to perform this step.
      logger.info(
        // Contribute this line to the enclosing declaration or statement.
        { requestId: req.requestId, eventId: event.id },
        // Continue the surrounding logic with this statement.
        `${logPrefix} duplicate event skipped`
      );
      // Return the resulting value to the caller.
      return {
        // Provide the status code field value.
        statusCode: 200,
        // Provide the body field value.
        body: { received: true },
      };
    }

    // Guard: early-return or throw when required input is missing/invalid.
    if (!result?.found) {
      // Call trackWebhookFailure to perform this step.
      trackWebhookFailure('reservation_not_found', {
        // Provide the request id field value.
        requestId: req.requestId,
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
        // Provide the event id field value.
        eventId: event.id,
      });
      // Return the resulting value to the caller.
      return {
        // Provide the status code field value.
        statusCode: 200,
        // Provide the body field value.
        body: { received: true },
      };
    }

    // Status / lifecycle guard before mutating domain state.
    if (result.reason === 'status_not_active' && result.reservation) {
      // Call trackWebhookFailure to perform this step.
      trackWebhookFailure('reservation_not_active', {
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the reservation id field value.
        reservationId: result.reservation.id?.toString?.(),
        // Provide the status field value.
        status: result.reservation.status,
        // Contribute this line to the enclosing declaration or statement.
        stripeSessionId,
      });
      // Return the resulting value to the caller.
      return {
        // Provide the status code field value.
        statusCode: 200,
        // Provide the body field value.
        body: { received: true },
      };
    }
  }

  // Return the resulting value to the caller.
  return {
    // Provide the status code field value.
    statusCode: 200,
    // Provide the body field value.
    body: { received: true },
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  handleStripeWebhookFlow,
};
