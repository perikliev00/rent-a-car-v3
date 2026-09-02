const stripe = require('../../config/stripe');
const { config } = require('../../config/env');
const logger = require('../../utils/logger');
const { getStripeCheckoutExpiresAt } = require('../../config/reservationTiming');
const stripeTestStub = require('./stripeTestStub');

function buildStripeCheckoutRedirectUrls() {
  const base = config.frontendBaseUrl;

  return {
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
  };
}

function buildCheckoutIdempotencyKey(reservationId, attempt) {
  return `checkout:reservation:${reservationId}:attempt${attempt}`;
}

async function createStripeCheckoutSession({
  car,
  pricing,
  reservationId,
  carId,
  sessionId,
  idempotencyKey,
}) {
  if (!idempotencyKey) {
    throw new Error('idempotencyKey is required');
  }

  if (stripeTestStub.isStubEnabled()) {
    return stripeTestStub.createSession({
      car,
      pricing,
      reservationId,
      carId,
      sessionId,
      idempotencyKey,
    });
  }

  const expiresAt = getStripeCheckoutExpiresAt();

  return stripe.checkout.sessions.create(
    {
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product_data: { name: `Car Rental – ${car.name}` },
            unit_amount: Math.round(Number(pricing.totalPrice) * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      expires_at: expiresAt,
      ...buildStripeCheckoutRedirectUrls(),
      client_reference_id: String(reservationId),
      metadata: {
        reservationId: String(reservationId),
        carId: String(carId),
        sessionId: String(sessionId),
      },
    },
    { idempotencyKey }
  );
}

async function expireStripeCheckoutSession(sessionId) {
  if (stripeTestStub.isStubEnabled()) {
    stripeTestStub.expireSession(sessionId);
    return { id: sessionId, status: 'expired' };
  }

  return stripe.checkout.sessions.expire(sessionId);
}

async function retrieveStripeCheckoutSession(sessionId) {
  if (stripeTestStub.isStubEnabled()) {
    return stripeTestStub.retrieveSession(sessionId);
  }

  return stripe.checkout.sessions.retrieve(sessionId);
}

async function retrieveStripePaymentIntent(paymentIntentId) {
  if (!paymentIntentId) {
    throw new Error('paymentIntentId is required');
  }

  if (stripeTestStub.isStubEnabled()) {
    return stripeTestStub.retrievePaymentIntent(paymentIntentId, {
      expand: ['latest_charge'],
    });
  }

  return stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
}

function isStripeExpireAlreadyTerminalError(err) {
  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('already') &&
    (message.includes('expired') || message.includes('complete'))
  );
}

async function safeExpireSupersededCheckoutSession(sessionId, context = {}) {
  if (!sessionId) {
    return { ok: true, skipped: true };
  }

  try {
    const session = await retrieveStripeCheckoutSession(sessionId);

    if (session.payment_status === 'paid' || session.status === 'complete') {
      return { ok: false, paid: true, session };
    }

    if (session.status === 'expired') {
      return { ok: true, alreadyExpired: true, session };
    }

    await expireStripeCheckoutSession(sessionId);
    return { ok: true, expired: true, session };
  } catch (err) {
    if (isStripeExpireAlreadyTerminalError(err)) {
      logger.warn(
        { err, sessionId, ...context },
        'Superseded Stripe checkout session was already expired or completed'
      );
      return { ok: true, alreadyExpired: true, error: err };
    }

    logger.warn(
      { err, sessionId, ...context },
      'Failed to expire superseded Stripe checkout session'
    );
    return { ok: false, error: err };
  }
}

module.exports = {
  buildCheckoutIdempotencyKey,
  createStripeCheckoutSession,
  expireStripeCheckoutSession,
  retrieveStripeCheckoutSession,
  retrieveStripePaymentIntent,
  safeExpireSupersededCheckoutSession,
};
