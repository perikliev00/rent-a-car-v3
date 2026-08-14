import Stripe from 'stripe';
import type { APIRequestContext, APIResponse } from '@playwright/test';
import { API_URL, STRIPE_SECRET, STRIPE_WEBHOOK_SECRET } from './test-env';

const stripe = new Stripe(STRIPE_SECRET);

export type CheckoutCompletedEventInput = {
  eventId: string;
  sessionId: string;
  reservationId: number | string;
  carId: number | string;
  sessionIdMeta: string;
  amountTotal?: number;
  currency?: string;
  paymentStatus?: string;
  paymentIntent?: string;
  metadata?: Record<string, string>;
};

export type CheckoutCompletedEvent = {
  id: string;
  type: 'checkout.session.completed';
  data: {
    object: {
      id: string;
      payment_status: string;
      amount_total: number;
      currency: string;
      client_reference_id: string;
      metadata: Record<string, string>;
      payment_intent: string;
    };
  };
};

export function buildCheckoutCompletedEvent({
  eventId,
  sessionId,
  reservationId,
  carId,
  sessionIdMeta,
  amountTotal = 0,
  currency = 'eur',
  paymentStatus = 'paid',
  paymentIntent = 'pi_test_e2e',
  metadata,
}: CheckoutCompletedEventInput): CheckoutCompletedEvent {
  return {
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_status: paymentStatus,
        amount_total: amountTotal,
        currency,
        client_reference_id: String(reservationId),
        metadata: {
          reservationId: String(reservationId),
          carId: String(carId),
          sessionId: String(sessionIdMeta),
          ...metadata,
        },
        payment_intent: paymentIntent,
      },
    },
  };
}

export function signWebhookPayload(event: CheckoutCompletedEvent): {
  raw: string;
  signature: string;
} {
  const raw = JSON.stringify(event);
  const signature = stripe.webhooks.generateTestHeaderString({
    payload: raw,
    secret: STRIPE_WEBHOOK_SECRET,
  });
  return { raw, signature };
}

export async function postSignedWebhook(
  request: APIRequestContext,
  event: CheckoutCompletedEvent
): Promise<APIResponse> {
  const { raw, signature } = signWebhookPayload(event);
  return request.post(`${API_URL}/webhook/stripe`, {
    headers: {
      'stripe-signature': signature,
      'Content-Type': 'application/json',
    },
    data: raw,
  });
}

/** Re-post the same signed event (same event.id) for idempotency checks. */
export async function replaySignedWebhook(
  request: APIRequestContext,
  event: CheckoutCompletedEvent
): Promise<APIResponse> {
  return postSignedWebhook(request, event);
}
