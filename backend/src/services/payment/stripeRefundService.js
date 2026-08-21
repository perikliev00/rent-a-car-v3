const stripe = require('../../config/stripe');
const stripeTestStub = require('./stripeTestStub');

async function createRefund({ paymentIntentId, amountCents = null, idempotencyKey }) {
  if (!paymentIntentId) {
    throw new Error('paymentIntentId is required');
  }
  if (!idempotencyKey) {
    throw new Error('idempotencyKey is required');
  }

  if (stripeTestStub.isStubEnabled()) {
    return stripeTestStub.createRefund({
      paymentIntentId,
      amountCents,
      idempotencyKey,
    });
  }

  const params = { payment_intent: paymentIntentId };
  if (amountCents != null) {
    params.amount = amountCents;
  }

  return stripe.refunds.create(params, { idempotencyKey });
}

async function retrieveRefund(refundId) {
  if (!refundId) {
    throw new Error('refundId is required');
  }

  if (stripeTestStub.isStubEnabled()) {
    return stripeTestStub.retrieveRefund(refundId);
  }

  return stripe.refunds.retrieve(refundId);
}

module.exports = {
  createRefund,
  retrieveRefund,
};
