/**
 * Thin Stripe refund API wrapper (create / retrieve).
 * Always requires an idempotency key so retries do not create duplicate refunds.
 * Routes to the in-memory stub when STRIPE_STUB is enabled.
 */
const stripe = require('../../config/stripe');
const stripeTestStub = require('./stripeTestStub');

/**
 * Create a Stripe refund against a PaymentIntent.
 * Omitting amountCents refunds the full remaining refundable amount (Stripe default).
 *
 * @param {object} params
 * @param {string} params.paymentIntentId
 * @param {number|null} [params.amountCents=null] - Partial refund in cents; null = full remaining
 * @param {string} params.idempotencyKey - Required; prevents duplicate refunds on retry
 * @returns {Promise<object>} Stripe Refund object
 * @throws {Error} When paymentIntentId or idempotencyKey is missing
 */
async function createRefund({ paymentIntentId, amountCents = null, idempotencyKey }) {
  // Hard-fail early: callers must always identify the PaymentIntent.
  if (!paymentIntentId) {
    throw new Error('paymentIntentId is required');
  }
  // Idempotency is mandatory so network retries cannot double-refund.
  if (!idempotencyKey) {
    throw new Error('idempotencyKey is required');
  }

  // In test/dev stub mode, never hit the real Stripe API.
  if (stripeTestStub.isStubEnabled()) {
    return stripeTestStub.createRefund({
      paymentIntentId,
      amountCents,
      idempotencyKey,
    });
  }

  // Stripe expects payment_intent; amount is optional (omit = full remaining).
  const params = { payment_intent: paymentIntentId };
  if (amountCents != null) {
    params.amount = amountCents;
  }

  // Pass idempotencyKey as request option (not as refund body field).
  return stripe.refunds.create(params, { idempotencyKey });
}

/**
 * Retrieve a Stripe refund by id.
 * @param {string} refundId
 * @returns {Promise<object>} Stripe Refund object
 * @throws {Error} When refundId is missing
 */
async function retrieveRefund(refundId) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!refundId) {
    throw new Error('refundId is required');
  }

  // Mirror createRefund: stub path for offline/tests.
  if (stripeTestStub.isStubEnabled()) {
    return stripeTestStub.retrieveRefund(refundId);
  }

  return stripe.refunds.retrieve(refundId);
}

module.exports = {
  createRefund,
  retrieveRefund,
};
