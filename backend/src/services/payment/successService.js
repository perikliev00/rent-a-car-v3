/**
 * Checkout success-page fulfillment: verify Stripe paid status, attempt
 * reservation finalization if the order is not yet created, and return a
 * guest-facing confirmation / “still processing” payload.
 * Intentionally soft-fails finalization errors so a paid guest is not shown a hard error.
 */
const logger = require('../../utils/logger');
// Destructure object properties into local variables.
const { retrieveStripeCheckoutSession } = require('./stripeCheckoutService');
// Require the '../../monitoring/logEvent' module as logEvent.
const logEvent = require('../../monitoring/logEvent');
// Require the '../../repositories/reservationRepository' module as reservationRepository.
const reservationRepository = require('../../repositories/reservationRepository');
// Destructure object properties into local variables.
const { findOrderByStripeSessionId } = require('../sql/orderSqlService');
// Destructure object properties into local variables.
const { finalizeReservationByStripeSessionId } = require('../bookingFinalizationService');
// Destructure object properties into local variables.
const { ValidationError } = require('../../utils/appError');
// Destructure object properties into local variables.
const { trackPaymentFailure } = require('../../monitoring/track');
// Destructure object properties into local variables.
const { formatDateForDisplay } = require('../../utils/dateFormatter');

// Create the support email constant.
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@rentacar.com';
// Create the support phone constant.
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '';

/**
 * Handle the browser return from Stripe Checkout success URL.
 * May finalize synchronously when the webhook has not yet created the order.
 *
 * @param {import('express').Request} req - Expects query.session_id and requestId
 * @returns {Promise<object>} View-model for the success page
 */
async function handleCheckoutSuccessFlow(req) {
  // Create the stripe session id constant.
  const stripeSessionId = req.query.session_id;
  // Stripe / payment-related branch.
  if (!stripeSessionId) {
    // Throw an error to stop the current control flow.
    throw new ValidationError('Invalid checkout session.');
  }

  // Create the session constant.
  const session = await retrieveStripeCheckoutSession(stripeSessionId);

  // Status / lifecycle guard before mutating domain state.
  if (session.payment_status !== 'paid') {
    // Call trackPaymentFailure to perform this step.
    trackPaymentFailure('payment_not_completed', {
      // Provide the request id field value.
      requestId: req.requestId,
      // Contribute this line to the enclosing declaration or statement.
      stripeSessionId,
      // Provide the payment status field value.
      paymentStatus: session.payment_status,
    });
    // Throw an error to stop the current control flow.
    throw new ValidationError('Payment was not completed.');
  }

  // Call logEvent.info to perform this step.
  logEvent.info('stripe.payment.succeeded', {
    // Provide the request id field value.
    requestId: req.requestId,
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Provide the source field value.
    source: 'success_page',
  });

  // Initialize the mutable order variable.
  let order = await findOrderByStripeSessionId(stripeSessionId);
  // Initialize the mutable confirmed variable.
  let confirmed = !!order;
  // Initialize the mutable booking status variable.
  let bookingStatus = confirmed ? 'confirmed' : 'processing_payment';
  // Initialize the mutable reservation variable.
  let reservation = null;

  // Webhook may still be in flight — attempt finalization from the success page path.
  if (!confirmed) {
    // Create the metadata constant.
    const metadata = session.metadata || {};
    // Protected block: isolate failure modes.
    try {
      // Create the result constant.
      const result = await finalizeReservationByStripeSessionId(stripeSessionId, {
        // Provide the reservation id field value.
        reservationId: metadata.reservationId || session.client_reference_id || null,
        // Provide the car id field value.
        carId: metadata.carId || null,
        // Provide the session id field value.
        sessionId: metadata.sessionId || null,
        // Provide the stripe session payment status field value.
        stripeSessionPaymentStatus: session.payment_status,
        // Provide the stripe session amount total field value.
        stripeSessionAmountTotal: session.amount_total ?? null,
        // Provide the stripe session currency field value.
        stripeSessionCurrency: session.currency || null,
        // Provide the log prefix field value.
        logPrefix: `[SuccessPage][${req.requestId}]`,
      });

      // Evaluate the condition and enter the branch when it is true.
      if (result.finalized || result.reason === 'already_confirmed') {
        // Update order with the right-hand side value.
        order = result.order || (await findOrderByStripeSessionId(stripeSessionId));
        // Update confirmed with the right-hand side value.
        confirmed = !!order;
        // Update bookingStatus with the right-hand side value.
        bookingStatus = confirmed ? 'confirmed' : bookingStatus;
        // Update reservation with the right-hand side value.
        reservation = result.reservation;
      // Continue the surrounding logic with this statement.
      } else if (result.reservation) {
        // Update reservation with the right-hand side value.
        reservation = result.reservation;
        // Update bookingStatus with the right-hand side value.
        bookingStatus = result.reservation.status || bookingStatus;
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Store the awaited result in reservation.
        reservation = await reservationRepository.findByStripeSessionId(stripeSessionId);
      }
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Keep the guest on a processing state instead of a hard failure when payment is paid
      // but finalization is still racing / blocked (manual review, transient errors).
      logger.warn(
        // Contribute this line to the enclosing declaration or statement.
        { err, requestId: req.requestId, stripeSessionId },
        // Supply the literal value used by the enclosing expression.
        'Checkout success finalization deferred'
      );
      // Store the awaited result in reservation.
      reservation = await reservationRepository.findByStripeSessionId(stripeSessionId);
      // Update bookingStatus with the right-hand side value.
      bookingStatus = reservation?.status || bookingStatus;
      // Update confirmed with the right-hand side value.
      confirmed = false;
    }
  }

  // Call logger.info to perform this step.
  logger.info(
    // Contribute this line to the enclosing declaration or statement.
    { requestId: req.requestId, stripeSessionId, confirmed, bookingStatus },
    // Supply the literal value used by the enclosing expression.
    'Checkout success page fulfillment status'
  );

  // Create the order reference constant.
  const orderReference = order ? `#${order.id}` : reservation ? `Reservation #${reservation.id}` : null;

  // Return the resulting value to the caller.
  return {
    // Provide the title field value.
    title: confirmed ? 'Booking Confirmed' : 'Payment Received',
    // Contribute this line to the enclosing declaration or statement.
    confirmed,
    // Contribute this line to the enclosing declaration or statement.
    bookingStatus,
    // Contribute this line to the enclosing declaration or statement.
    stripeSessionId,
    // Contribute this line to the enclosing declaration or statement.
    orderReference,
    // Provide the order id field value.
    orderId: order?.id || null,
    // Provide the reservation id field value.
    reservationId: reservation?.id || order?.reservationId || null,
    // Provide the support email field value.
    supportEmail: SUPPORT_EMAIL,
    // Provide the support phone field value.
    supportPhone: SUPPORT_PHONE,
    // Provide the pickup summary field value.
    pickupSummary: order
      // Continue the surrounding logic with this statement.
      ? `${formatDateForDisplay(order.pickupDate)} — ${order.pickupLocation}`
      // Contribute this line to the enclosing declaration or statement.
      : null,
    // Provide the message field value.
    message: confirmed
      // Contribute this line to the enclosing declaration or statement.
      ? 'Your booking has been confirmed. A confirmation email will be sent shortly if email is configured.'
      // Contribute this line to the enclosing declaration or statement.
      : 'Your payment was received. We are confirming your booking — this page will refresh automatically.',
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  handleCheckoutSuccessFlow,
};
