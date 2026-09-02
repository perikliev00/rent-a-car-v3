const logger = require('../../../utils/logger');
const {
  retrieveStripeCheckoutSession,
  retrieveStripePaymentIntent,
} = require('../stripeCheckoutService');
const { refundError } = require('./refundErrors');

function chargeFromPaymentIntent(paymentIntent) {
  const charge = paymentIntent?.latest_charge;
  if (charge && typeof charge === 'object') {
    return charge;
  }
  return null;
}

function originalPaidCents(paymentIntent) {
  const charge = chargeFromPaymentIntent(paymentIntent);
  if (charge) {
    const captured = Number(charge.amount_captured ?? charge.amount ?? 0);
    if (Number.isFinite(captured) && captured > 0) {
      return captured;
    }
  }

  const received = Number(paymentIntent?.amount_received ?? paymentIntent?.amount ?? 0);
  return Number.isFinite(received) && received > 0 ? received : null;
}

function remainingRefundableCents(paymentIntent) {
  const charge = chargeFromPaymentIntent(paymentIntent);
  if (charge) {
    const captured = Number(charge.amount_captured ?? charge.amount ?? 0);
    const refunded = Number(charge.amount_refunded ?? 0);
    if (Number.isFinite(captured) && Number.isFinite(refunded)) {
      return Math.max(0, captured - refunded);
    }
  }

  const received = Number(paymentIntent?.amount_received ?? paymentIntent?.amount ?? 0);
  return Number.isFinite(received) ? Math.max(0, received) : null;
}

function snapshotAmountCents(reservation) {
  const cents = Number(reservation?.paidAmountCents);
  return Number.isFinite(cents) && cents > 0 ? cents : null;
}

async function resolvePaymentIntentIdFromCheckoutSession(reservation) {
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

  const amountTotal =
    session.amount_total != null && Number.isFinite(Number(session.amount_total))
      ? Number(session.amount_total)
      : null;

  return {
    paymentIntentId: String(pi),
    amountCents: amountTotal,
    currency: session.currency || null,
    source: 'checkout_session',
  };
}

async function resolveFromPaymentIntent(paymentIntentId) {
  const paymentIntent = await retrieveStripePaymentIntent(paymentIntentId);
  const remaining = remainingRefundableCents(paymentIntent);
  const paid = originalPaidCents(paymentIntent);

  return {
    paymentIntentId: String(paymentIntentId),
    amountCents: remaining,
    currency: paymentIntent.currency || null,
    source: 'stripe_pi',
    paidAmountCents: paid,
  };
}

/**
 * Resolve Stripe Payment Intent id and remaining refundable amount.
 * Prefers stored PI; falls back to Checkout Session retrieve.
 * Amount comes from Stripe remaining (or the write-once paid snapshot), never the quote.
 */
async function resolvePaymentIntentForReservation(reservation) {
  const existing = reservation?.stripePaymentIntentId;
  let paymentIntentId = existing ? String(existing) : null;
  let sessionFallback = null;

  if (!paymentIntentId) {
    sessionFallback = await resolvePaymentIntentIdFromCheckoutSession(reservation);
    paymentIntentId = sessionFallback.paymentIntentId;
  }

  if (paymentIntentId) {
    try {
      const fromPi = await resolveFromPaymentIntent(paymentIntentId);
      if (fromPi.amountCents === 0) {
        return fromPi;
      }
      if (fromPi.amountCents > 0) {
        return fromPi;
      }
    } catch (err) {
      logger.warn(
        {
          err,
          reservationId: reservation?.id,
          paymentIntentId,
        },
        'Failed to retrieve Stripe PaymentIntent remaining refundable amount'
      );
    }
  }

  const snapshot = snapshotAmountCents(reservation);
  if (snapshot) {
    return {
      paymentIntentId,
      amountCents: snapshot,
      currency: reservation.paidCurrency || sessionFallback?.currency || 'eur',
      source: 'snapshot',
      paidAmountCents: snapshot,
    };
  }

  if (sessionFallback?.amountCents > 0) {
    return {
      ...sessionFallback,
      paidAmountCents: sessionFallback.amountCents,
    };
  }

  if (!paymentIntentId) {
    throw refundError(
      'REFUND_NO_PAYMENT_INTENT',
      'Cannot refund: reservation has no Stripe Payment Intent or Checkout Session.'
    );
  }

  throw refundError('REFUND_NO_AMOUNT', 'Cannot refund: missing refundable amount.');
}

module.exports = {
  resolvePaymentIntentForReservation,
  remainingRefundableCents,
  originalPaidCents,
  refundError,
};
