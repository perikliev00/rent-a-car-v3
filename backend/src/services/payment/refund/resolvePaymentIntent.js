const { retrieveStripeCheckoutSession } = require('../stripeCheckoutService');
const { refundError } = require('./refundErrors');

/**
 * Resolve Stripe Payment Intent id for a reservation.
 * Prefers stored PI; falls back to Checkout Session retrieve.
 */
async function resolvePaymentIntentForReservation(reservation) {
  const existing = reservation?.stripePaymentIntentId;
  if (existing) {
    return {
      paymentIntentId: String(existing),
      amountCents: null,
      currency: null,
      source: 'reservation',
    };
  }

  const sessionId = reservation?.stripeSessionId;
  if (!sessionId) {
    throw refundError(
      'REFUND_NO_PAYMENT_INTENT',
      'Cannot refund: reservation has no Stripe Payment Intent or Checkout Session.'
    );
  }

  let session;
  try {
    session = await retrieveStripeCheckoutSession(sessionId);
  } catch (err) {
    throw refundError(
      'REFUND_NO_PAYMENT_INTENT',
      `Cannot refund: failed to retrieve Checkout Session (${err.message}).`
    );
  }

  const pi =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id || null;

  if (!pi) {
    throw refundError(
      'REFUND_NO_PAYMENT_INTENT',
      'Cannot refund: Checkout Session has no Payment Intent.'
    );
  }

  return {
    paymentIntentId: String(pi),
    amountCents:
      session.amount_total != null && Number.isFinite(Number(session.amount_total))
        ? Number(session.amount_total)
        : null,
    currency: session.currency || null,
    source: 'checkout_session',
  };
}

module.exports = {
  resolvePaymentIntentForReservation,
  refundError,
};
