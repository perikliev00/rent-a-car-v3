/**
 * Stripe Checkout session create / expire / retrieve helpers.
 * All calls are stub-aware (STRIPE_STUB) so E2E can run without real Stripe.
 * Idempotency keys prevent duplicate Checkout sessions on retries.
 */
const stripe = require('../../config/stripe');
const { config } = require('../../config/env');
const logger = require('../../utils/logger');
const { getStripeCheckoutExpiresAt } = require('../../config/reservationTiming');
const stripeTestStub = require('./stripeTestStub');

/**
 * Build success/cancel redirect URLs for Checkout; Stripe replaces {CHECKOUT_SESSION_ID}.
 * @returns {{ success_url: string, cancel_url: string }}
 */
function buildStripeCheckoutRedirectUrls() {
  const base = config.frontendBaseUrl;

  return {
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/checkout/cancel?session_id={CHECKOUT_SESSION_ID}`,
  };
}

/**
 * Stable Stripe idempotency key per reservation + checkout attempt.
 * Retries with the same key return the same session instead of creating another charge path.
 *
 * @param {string|number} reservationId
 * @param {number} attempt
 * @returns {string}
 */
function buildCheckoutIdempotencyKey(reservationId, attempt) {
  return `checkout:reservation:${reservationId}:attempt${attempt}`;
}

/**
 * Create a Stripe Checkout Session for a car rental payment.
 * Metadata + client_reference_id carry reservation identity into webhooks/success.
 *
 * @param {object} params
 * @param {object} params.car
 * @param {{ totalPrice: number }} params.pricing - Amount in major currency units (EUR)
 * @param {string|number} params.reservationId
 * @param {string|number} params.carId
 * @param {string|number} params.sessionId - Browse/checkout session id for correlation
 * @param {string} params.idempotencyKey - Required Stripe idempotency key
 * @returns {Promise<object>} Stripe Checkout Session (or stub equivalent)
 */
async function createStripeCheckoutSession({
  car,
  pricing,
  reservationId,
  carId,
  sessionId,
  idempotencyKey,
}) {
  // Idempotency guard: return early when work was already applied.
  if (!idempotencyKey) {
    throw new Error('idempotencyKey is required');
  }

  // Stripe / payment-related branch.
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
            // Stripe expects integer minor units (cents).
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

/**
 * Expire an open Checkout session (e.g. when superseded by a newer attempt).
 * @param {string} sessionId
 * @returns {Promise<object>}
 */
async function expireStripeCheckoutSession(sessionId) {
  // Stripe / payment-related branch.
  if (stripeTestStub.isStubEnabled()) {
    stripeTestStub.expireSession(sessionId);
    return { id: sessionId, status: 'expired' };
  }

  return stripe.checkout.sessions.expire(sessionId);
}

/**
 * Retrieve a Checkout session by id (stub or live Stripe).
 * @param {string} sessionId
 * @returns {Promise<object>}
 */
async function retrieveStripeCheckoutSession(sessionId) {
  // Stripe / payment-related branch.
  if (stripeTestStub.isStubEnabled()) {
    return stripeTestStub.retrieveSession(sessionId);
  }

  return stripe.checkout.sessions.retrieve(sessionId);
}

/**
 * Retrieve a PaymentIntent with latest_charge expanded (used for refunds / remaining balance).
 * @param {string} paymentIntentId
 * @returns {Promise<object>}
 */
async function retrieveStripePaymentIntent(paymentIntentId) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!paymentIntentId) {
    throw new Error('paymentIntentId is required');
  }

  // Stripe / payment-related branch.
  if (stripeTestStub.isStubEnabled()) {
    return stripeTestStub.retrievePaymentIntent(paymentIntentId, {
      expand: ['latest_charge'],
    });
  }

  return stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ['latest_charge'],
  });
}

/**
 * Stripe may reject expire when the session is already expired or completed.
 * @param {Error} err
 * @returns {boolean}
 */
function isStripeExpireAlreadyTerminalError(err) {
  const message = String(err?.message || '').toLowerCase();
  return (
    message.includes('already') &&
    (message.includes('expired') || message.includes('complete'))
  );
}

/**
 * Best-effort expire of a Checkout session that was superseded by a newer one.
 * Never expires a paid/complete session — that would risk orphaning a successful payment.
 *
 * @param {string|null|undefined} sessionId
 * @param {object} [context] - Extra fields for structured logs
 * @returns {Promise<{ ok: boolean, skipped?: boolean, paid?: boolean, alreadyExpired?: boolean, expired?: boolean, session?: object, error?: Error }>}
 */
async function safeExpireSupersededCheckoutSession(sessionId, context = {}) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!sessionId) {
    return { ok: true, skipped: true };
  }

  // Protected block: isolate failure modes.
  try {
    const session = await retrieveStripeCheckoutSession(sessionId);

    // Do not expire paid sessions — payment may still need finalization.
    if (session.payment_status === 'paid' || session.status === 'complete') {
      return { ok: false, paid: true, session };
    }

    // Status / lifecycle guard before mutating domain state.
    if (session.status === 'expired') {
      return { ok: true, alreadyExpired: true, session };
    }

    await expireStripeCheckoutSession(sessionId);
    return { ok: true, expired: true, session };
  } catch (err) {
    // Idempotency guard: return early when work was already applied.
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
