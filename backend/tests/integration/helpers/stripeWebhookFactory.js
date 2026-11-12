const request = require('supertest');
const stripe = require('stripe')(process.env.STRIPE_SECRET);

function buildCheckoutCompletedEvent({
  eventId,
  sessionId,
  reservationId,
  carId,
  sessionIdMeta,
  amountTotal,
  paymentStatus = 'paid',
  currency = 'eur',
  paymentIntent = 'pi_test_integration',
  metadata,
  clientReferenceId,
}) {
  return {
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_status: paymentStatus,
        amount_total: amountTotal,
        currency,
        client_reference_id:
          clientReferenceId != null
            ? String(clientReferenceId)
            : reservationId != null
              ? String(reservationId)
              : null,
        metadata:
          metadata ||
          {
            reservationId: reservationId != null ? String(reservationId) : '',
            carId: carId != null ? String(carId) : '',
            sessionId: sessionIdMeta != null ? String(sessionIdMeta) : '',
          },
        payment_intent: paymentIntent,
      },
    },
  };
}

function buildStripeEvent({ eventId, type, object = {} }) {
  return {
    id: eventId,
    type,
    data: {
      object,
    },
  };
}

function signWebhookPayload(payload) {
  const raw = JSON.stringify(payload);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: raw,
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  return { raw, signature };
}

async function postSignedWebhook(app, event) {
  const { raw, signature } = signWebhookPayload(event);
  return request(app)
    .post('/webhook/stripe')
    .set('stripe-signature', signature)
    .set('Content-Type', 'application/json')
    .send(raw);
}

async function postUnsignedWebhook(app, event) {
  return request(app)
    .post('/webhook/stripe')
    .set('stripe-signature', 't=1,v1=invalid')
    .set('Content-Type', 'application/json')
    .send(JSON.stringify(event));
}

module.exports = {
  buildCheckoutCompletedEvent,
  buildStripeEvent,
  signWebhookPayload,
  postSignedWebhook,
  postUnsignedWebhook,
};
