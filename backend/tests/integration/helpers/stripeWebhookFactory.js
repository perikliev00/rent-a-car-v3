// Require the 'supertest' module as request.
const request = require('supertest');
// Require the 'stripe' module as stripe.
const stripe = require('stripe')(process.env.STRIPE_SECRET);

// Define the buildCheckoutCompletedEvent function.
function buildCheckoutCompletedEvent({
  // Contribute this line to the enclosing declaration or statement.
  eventId,
  // Contribute this line to the enclosing declaration or statement.
  sessionId,
  // Contribute this line to the enclosing declaration or statement.
  reservationId,
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  sessionIdMeta,
  // Contribute this line to the enclosing declaration or statement.
  amountTotal,
  // Update paymentStatus with the right-hand side value.
  paymentStatus = 'paid',
  // Update currency with the right-hand side value.
  currency = 'eur',
  // Update paymentIntent with the right-hand side value.
  paymentIntent = 'pi_test_integration',
  // Contribute this line to the enclosing declaration or statement.
  metadata,
  // Contribute this line to the enclosing declaration or statement.
  clientReferenceId,
// Continue the surrounding logic with this statement.
}) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: eventId,
    // Provide the type field value.
    type: 'checkout.session.completed',
    // Provide the data field value.
    data: {
      // Provide the object field value.
      object: {
        // Provide the id field value.
        id: sessionId,
        // Provide the payment status field value.
        payment_status: paymentStatus,
        // Provide the amount total field value.
        amount_total: amountTotal,
        // Contribute this line to the enclosing declaration or statement.
        currency,
        // Provide the client reference id field value.
        client_reference_id:
          // Continue the surrounding logic with this statement.
          clientReferenceId != null
            // Continue the surrounding logic with this statement.
            ? String(clientReferenceId)
            // Continue the surrounding logic with this statement.
            : reservationId != null
              // Continue the surrounding logic with this statement.
              ? String(reservationId)
              // Contribute this line to the enclosing declaration or statement.
              : null,
        // Provide the metadata field value.
        metadata:
          // Contribute this line to the enclosing declaration or statement.
          metadata ||
          {
            // Provide the reservation id field value.
            reservationId: reservationId != null ? String(reservationId) : '',
            // Provide the car id field value.
            carId: carId != null ? String(carId) : '',
            // Provide the session id field value.
            sessionId: sessionIdMeta != null ? String(sessionIdMeta) : '',
          },
        // Provide the payment intent field value.
        payment_intent: paymentIntent,
      },
    },
  };
}

// Define the buildStripeEvent function.
function buildStripeEvent({ eventId, type, object = {} }) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: eventId,
    // Contribute this line to the enclosing declaration or statement.
    type,
    // Provide the data field value.
    data: {
      // Contribute this line to the enclosing declaration or statement.
      object,
    },
  };
}

// Define the signWebhookPayload function.
function signWebhookPayload(payload) {
  // Create the raw constant.
  const raw = JSON.stringify(payload);
  // Create the signature constant.
  const signature = stripe.webhooks.generateTestHeaderString({
    // Provide the payload field value.
    payload: raw,
    // Provide the secret field value.
    secret: process.env.STRIPE_WEBHOOK_SECRET,
  });
  // Return the resulting value to the caller.
  return { raw, signature };
}

// Define the async function postSignedWebhook.
async function postSignedWebhook(app, event) {
  // Destructure object properties into local variables.
  const { raw, signature } = signWebhookPayload(event);
  // Return the resulting value to the caller.
  return request(app)
    // Call .post to perform this step.
    .post('/webhook/stripe')
    // Call .set to perform this step.
    .set('stripe-signature', signature)
    // Call .set to perform this step.
    .set('Content-Type', 'application/json')
    // Call .send to perform this step.
    .send(raw);
}

// Define the async function postUnsignedWebhook.
async function postUnsignedWebhook(app, event) {
  // Return the resulting value to the caller.
  return request(app)
    // Call .post to perform this step.
    .post('/webhook/stripe')
    // Call .set to perform this step.
    .set('stripe-signature', 't=1,v1=invalid')
    // Call .set to perform this step.
    .set('Content-Type', 'application/json')
    // Call .send to perform this step.
    .send(JSON.stringify(event));
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  buildCheckoutCompletedEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildStripeEvent,
  // Contribute this line to the enclosing declaration or statement.
  signWebhookPayload,
  // Contribute this line to the enclosing declaration or statement.
  postSignedWebhook,
  // Contribute this line to the enclosing declaration or statement.
  postUnsignedWebhook,
};
