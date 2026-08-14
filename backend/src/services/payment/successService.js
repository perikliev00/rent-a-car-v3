const logger = require('../../utils/logger');
const { retrieveStripeCheckoutSession } = require('./stripeCheckoutService');
const logEvent = require('../../monitoring/logEvent');
const reservationRepository = require('../../repositories/reservationRepository');
const { findOrderByStripeSessionId } = require('../sql/orderSqlService');
const { finalizeReservationByStripeSessionId } = require('../bookingFinalizationService');
const { ValidationError } = require('../../utils/appError');
const { trackPaymentFailure } = require('../../monitoring/track');
const { formatDateForDisplay } = require('../../utils/dateFormatter');

const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || 'support@rentacar.com';
const SUPPORT_PHONE = process.env.SUPPORT_PHONE || '';

async function handleCheckoutSuccessFlow(req) {
  const stripeSessionId = req.query.session_id;
  if (!stripeSessionId) {
    throw new ValidationError('Invalid checkout session.');
  }

  const session = await retrieveStripeCheckoutSession(stripeSessionId);

  if (session.payment_status !== 'paid') {
    trackPaymentFailure('payment_not_completed', {
      requestId: req.requestId,
      stripeSessionId,
      paymentStatus: session.payment_status,
    });
    throw new ValidationError('Payment was not completed.');
  }

  logEvent.info('stripe.payment.succeeded', {
    requestId: req.requestId,
    stripeSessionId,
    source: 'success_page',
  });

  let order = await findOrderByStripeSessionId(stripeSessionId);
  let confirmed = !!order;
  let bookingStatus = confirmed ? 'confirmed' : 'processing_payment';
  let reservation = null;

  if (!confirmed) {
    const metadata = session.metadata || {};
    try {
      const result = await finalizeReservationByStripeSessionId(stripeSessionId, {
        reservationId: metadata.reservationId || session.client_reference_id || null,
        carId: metadata.carId || null,
        sessionId: metadata.sessionId || null,
        stripeSessionPaymentStatus: session.payment_status,
        stripeSessionAmountTotal: session.amount_total ?? null,
        stripeSessionCurrency: session.currency || null,
        logPrefix: `[SuccessPage][${req.requestId}]`,
      });

      if (result.finalized || result.reason === 'already_confirmed') {
        order = result.order || (await findOrderByStripeSessionId(stripeSessionId));
        confirmed = !!order;
        bookingStatus = confirmed ? 'confirmed' : bookingStatus;
        reservation = result.reservation;
      } else if (result.reservation) {
        reservation = result.reservation;
        bookingStatus = result.reservation.status || bookingStatus;
      } else {
        reservation = await reservationRepository.findByStripeSessionId(stripeSessionId);
      }
    } catch (err) {
      // Keep the guest on a processing state instead of a hard failure when payment is paid
      // but finalization is still racing / blocked (manual review, transient errors).
      logger.warn(
        { err, requestId: req.requestId, stripeSessionId },
        'Checkout success finalization deferred'
      );
      reservation = await reservationRepository.findByStripeSessionId(stripeSessionId);
      bookingStatus = reservation?.status || bookingStatus;
      confirmed = false;
    }
  }

  logger.info(
    { requestId: req.requestId, stripeSessionId, confirmed, bookingStatus },
    'Checkout success page fulfillment status'
  );

  const orderReference = order ? `#${order.id}` : reservation ? `Reservation #${reservation.id}` : null;

  return {
    title: confirmed ? 'Booking Confirmed' : 'Payment Received',
    confirmed,
    bookingStatus,
    stripeSessionId,
    orderReference,
    orderId: order?.id || null,
    reservationId: reservation?.id || order?.reservationId || null,
    supportEmail: SUPPORT_EMAIL,
    supportPhone: SUPPORT_PHONE,
    pickupSummary: order
      ? `${formatDateForDisplay(order.pickupDate)} — ${order.pickupLocation}`
      : null,
    message: confirmed
      ? 'Your booking has been confirmed. A confirmation email will be sent shortly if email is configured.'
      : 'Your payment was received. We are confirming your booking — this page will refresh automatically.',
  };
}

module.exports = {
  handleCheckoutSuccessFlow,
};
