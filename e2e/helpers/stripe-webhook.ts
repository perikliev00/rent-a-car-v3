// Import Stripe from 'stripe'.
import Stripe from 'stripe';
// Contribute this line to the enclosing declaration or statement.
import type { APIRequestContext, APIResponse } from '@playwright/test';
// Import named exports from './test-env'.
import { API_URL, STRIPE_SECRET, STRIPE_WEBHOOK_SECRET } from './test-env';

// Create the stripe constant.
const stripe = new Stripe(STRIPE_SECRET);

// Export the checkout completed event input type.
export type CheckoutCompletedEventInput = {
  // Provide the event id field value.
  eventId: string;
  // Provide the session id field value.
  sessionId: string;
  // Provide the reservation id field value.
  reservationId: number | string;
  // Provide the car id field value.
  carId: number | string;
  // Provide the session id meta field value.
  sessionIdMeta: string;
  // Contribute this line to the enclosing declaration or statement.
  amountTotal?: number;
  // Contribute this line to the enclosing declaration or statement.
  currency?: string;
  // Contribute this line to the enclosing declaration or statement.
  paymentStatus?: string;
  // Contribute this line to the enclosing declaration or statement.
  paymentIntent?: string;
  // Continue the surrounding logic with this statement.
  metadata?: Record<string, string>;
};

// Export the checkout completed event type.
export type CheckoutCompletedEvent = {
  // Provide the id field value.
  id: string;
  // Provide the type field value.
  type: 'checkout.session.completed';
  // Provide the data field value.
  data: {
    // Provide the object field value.
    object: {
      // Provide the id field value.
      id: string;
      // Provide the payment status field value.
      payment_status: string;
      // Provide the amount total field value.
      amount_total: number;
      // Provide the currency field value.
      currency: string;
      // Provide the client reference id field value.
      client_reference_id: string;
      // Provide the metadata field value.
      metadata: Record<string, string>;
      // Provide the payment intent field value.
      payment_intent: string;
    };
  };
};

// Export the buildCheckoutCompletedEvent function.
export function buildCheckoutCompletedEvent({
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
  // Update amountTotal with the right-hand side value.
  amountTotal = 0,
  // Update currency with the right-hand side value.
  currency = 'eur',
  // Update paymentStatus with the right-hand side value.
  paymentStatus = 'paid',
  // Update paymentIntent with the right-hand side value.
  paymentIntent = 'pi_test_e2e',
  // Contribute this line to the enclosing declaration or statement.
  metadata,
// Continue the surrounding logic with this statement.
}: CheckoutCompletedEventInput): CheckoutCompletedEvent {
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
        client_reference_id: String(reservationId),
        // Provide the metadata field value.
        metadata: {
          // Provide the reservation id field value.
          reservationId: String(reservationId),
          // Provide the car id field value.
          carId: String(carId),
          // Provide the session id field value.
          sessionId: String(sessionIdMeta),
          // Spread metadata into the surrounding structure.
          ...metadata,
        },
        // Provide the payment intent field value.
        payment_intent: paymentIntent,
      },
    },
  };
}

// Export the signWebhookPayload function.
export function signWebhookPayload(event: CheckoutCompletedEvent): {
  // Provide the raw field value.
  raw: string;
  // Provide the signature field value.
  signature: string;
// Contribute this line to the enclosing declaration or statement.
} {
  // Create the raw constant.
  const raw = JSON.stringify(event);
  // Create the signature constant.
  const signature = stripe.webhooks.generateTestHeaderString({
    // Provide the payload field value.
    payload: raw,
    // Provide the secret field value.
    secret: STRIPE_WEBHOOK_SECRET,
  });
  // Return the resulting value to the caller.
  return { raw, signature };
}

// Export the async postSignedWebhook function.
export async function postSignedWebhook(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the event field value.
  event: CheckoutCompletedEvent
// Continue the surrounding logic with this statement.
): Promise<APIResponse> {
  // Destructure object properties into local variables.
  const { raw, signature } = signWebhookPayload(event);
  // Return the resulting value to the caller.
  return request.post(`${API_URL}/webhook/stripe`, {
    // Provide the headers field value.
    headers: {
      // Supply the literal value used by the enclosing expression.
      'stripe-signature': signature,
      // Supply the literal value used by the enclosing expression.
      'Content-Type': 'application/json',
    },
    // Provide the data field value.
    data: raw,
  });
}

/** Re-post the same signed event (same event.id) for idempotency checks. */
export async function replaySignedWebhook(
  // Provide the request field value.
  request: APIRequestContext,
  // Provide the event field value.
  event: CheckoutCompletedEvent
// Continue the surrounding logic with this statement.
): Promise<APIResponse> {
  // Return the resulting value to the caller.
  return postSignedWebhook(request, event);
}
