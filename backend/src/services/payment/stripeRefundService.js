/**
 * Thin Stripe refund API wrapper (create / retrieve).
 * Always requires an idempotency key so retries do not create duplicate refunds.
 * Routes to the in-memory stub when STRIPE_STUB is enabled.
 */
const stripe = require('../../config/stripe');
// Require the './stripeTestStub' module as stripeTestStub.
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
    // Throw an error to stop the current control flow.
    throw new Error('paymentIntentId is required');
  }
  // Idempotency is mandatory so network retries cannot double-refund.
  if (!idempotencyKey) {
    // Throw an error to stop the current control flow.
    throw new Error('idempotencyKey is required');
  }

  // In test/dev stub mode, never hit the real Stripe API.
  if (stripeTestStub.isStubEnabled()) {
    // Return the resulting value to the caller.
    return stripeTestStub.createRefund({
      // Contribute this line to the enclosing declaration or statement.
      paymentIntentId,
      // Contribute this line to the enclosing declaration or statement.
      amountCents,
      // Contribute this line to the enclosing declaration or statement.
      idempotencyKey,
    });
  }

  // Stripe expects payment_intent; amount is optional (omit = full remaining).
  const params = { payment_intent: paymentIntentId };
  // Evaluate the condition and enter the branch when it is true.
  if (amountCents != null) {
    // Update params.amount with the right-hand side value.
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
    // Throw an error to stop the current control flow.
    throw new Error('refundId is required');
  }

  // Mirror createRefund: stub path for offline/tests.
  if (stripeTestStub.isStubEnabled()) {
    // Return the resulting value to the caller.
    return stripeTestStub.retrieveRefund(refundId);
  }

  // Return the resulting value to the caller.
  return stripe.refunds.retrieve(refundId);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createRefund,
  // Contribute this line to the enclosing declaration or statement.
  retrieveRefund,
};
