/**
 * Stripe Checkout session create / expire / retrieve helpers.
 * All calls are stub-aware (STRIPE_STUB) so E2E can run without real Stripe.
 * Idempotency keys prevent duplicate Checkout sessions on retries.
 */
const stripe = require('../../config/stripe');
// Destructure object properties into local variables.
const { config } = require('../../config/env');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Destructure object properties into local variables.
const { getStripeCheckoutExpiresAt } = require('../../config/reservationTiming');
// Require the './stripeTestStub' module as stripeTestStub.
const stripeTestStub = require('./stripeTestStub');

/**
 * Build success/cancel redirect URLs for Checkout; Stripe replaces {CHECKOUT_SESSION_ID}.
 * @returns {{ success_url: string, cancel_url: string }}
 */
function buildStripeCheckoutRedirectUrls() {
  // Create the base constant.
  const base = config.frontendBaseUrl;

  // Return the resulting value to the caller.
  return {
    // Provide the success url field value.
    success_url: `${base}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
    // Provide the cancel url field value.
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
  // Return the resulting value to the caller.
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
  // Contribute this line to the enclosing declaration or statement.
  car,
  // Contribute this line to the enclosing declaration or statement.
  pricing,
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  sessionId,
  // Contribute this line to the enclosing declaration or statement.
  idempotencyKey,
// Continue the surrounding logic with this statement.
}) {
  // Idempotency guard: return early when work was already applied.
  if (!idempotencyKey) {
    // Throw an error to stop the current control flow.
    throw new Error('idempotencyKey is required');
  }

  // Stripe / payment-related branch.
  if (stripeTestStub.isStubEnabled()) {
    // Return the resulting value to the caller.
    return stripeTestStub.createSession({
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      pricing,
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Contribute this line to the enclosing declaration or statement.
      sessionId,
      // Contribute this line to the enclosing declaration or statement.
      idempotencyKey,
    });
  }

  // Create the expires at constant.
  const expiresAt = getStripeCheckoutExpiresAt();

  // Return the resulting value to the caller.
  return stripe.checkout.sessions.create(
    {
      // Provide the payment method types field value.
      payment_method_types: ['card'],
      // Provide the line items field value.
      line_items: [
        {
          // Provide the price data field value.
          price_data: {
            // Provide the currency field value.
            currency: 'eur',
            // Provide the product data field value.
            product_data: { name: `Car Rental – ${car.name}` },
            // Stripe expects integer minor units (cents).
            unit_amount: Math.round(Number(pricing.totalPrice) * 100),
          },
          // Provide the quantity field value.
          quantity: 1,
        },
      ],
      // Provide the mode field value.
      mode: 'payment',
      // Provide the expires at field value.
      expires_at: expiresAt,
      // Call ...buildStripeCheckoutRedirectUrls to perform this step.
      ...buildStripeCheckoutRedirectUrls(),
      // Provide the client reference id field value.
      client_reference_id: String(reservationId),
      // Provide the metadata field value.
      metadata: {
        // Provide the reservation id field value.
        reservationId: String(reservationId),
        // Provide the car id field value.
        carId: String(carId),
        // Provide the session id field value.
        sessionId: String(sessionId),
      },
    },
    // Contribute this line to the enclosing declaration or statement.
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
    // Call stripeTestStub.expireSession to perform this step.
    stripeTestStub.expireSession(sessionId);
    // Return the resulting value to the caller.
    return { id: sessionId, status: 'expired' };
  }

  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return stripeTestStub.retrieveSession(sessionId);
  }

  // Return the resulting value to the caller.
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
    // Throw an error to stop the current control flow.
    throw new Error('paymentIntentId is required');
  }

  // Stripe / payment-related branch.
  if (stripeTestStub.isStubEnabled()) {
    // Return the resulting value to the caller.
    return stripeTestStub.retrievePaymentIntent(paymentIntentId, {
      // Provide the expand field value.
      expand: ['latest_charge'],
    });
  }

  // Return the resulting value to the caller.
  return stripe.paymentIntents.retrieve(paymentIntentId, {
    // Provide the expand field value.
    expand: ['latest_charge'],
  });
}

/**
 * Stripe may reject expire when the session is already expired or completed.
 * @param {Error} err
 * @returns {boolean}
 */
function isStripeExpireAlreadyTerminalError(err) {
  // Create the message constant.
  const message = String(err?.message || '').toLowerCase();
  // Return control to the caller with the following value.
  return (
    // Call message.includes to perform this step.
    message.includes('already') &&
    // Continue the surrounding logic with this statement.
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
    // Return the resulting value to the caller.
    return { ok: true, skipped: true };
  }

  // Protected block: isolate failure modes.
  try {
    // Create the session constant.
    const session = await retrieveStripeCheckoutSession(sessionId);

    // Do not expire paid sessions — payment may still need finalization.
    if (session.payment_status === 'paid' || session.status === 'complete') {
      // Return the resulting value to the caller.
      return { ok: false, paid: true, session };
    }

    // Status / lifecycle guard before mutating domain state.
    if (session.status === 'expired') {
      // Return the resulting value to the caller.
      return { ok: true, alreadyExpired: true, session };
    }

    // Wait until the asynchronous operation resolves.
    await expireStripeCheckoutSession(sessionId);
    // Return the resulting value to the caller.
    return { ok: true, expired: true, session };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Idempotency guard: return early when work was already applied.
    if (isStripeExpireAlreadyTerminalError(err)) {
      // Call logger.warn to perform this step.
      logger.warn(
        // Contribute this line to the enclosing declaration or statement.
        { err, sessionId, ...context },
        // Supply the literal value used by the enclosing expression.
        'Superseded Stripe checkout session was already expired or completed'
      );
      // Return the resulting value to the caller.
      return { ok: true, alreadyExpired: true, error: err };
    }

    // Call logger.warn to perform this step.
    logger.warn(
      // Contribute this line to the enclosing declaration or statement.
      { err, sessionId, ...context },
      // Supply the literal value used by the enclosing expression.
      'Failed to expire superseded Stripe checkout session'
    );
    // Return the resulting value to the caller.
    return { ok: false, error: err };
  }
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  buildCheckoutIdempotencyKey,
  // Contribute this line to the enclosing declaration or statement.
  createStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  expireStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  retrieveStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  retrieveStripePaymentIntent,
  // Contribute this line to the enclosing declaration or statement.
  safeExpireSupersededCheckoutSession,
};
