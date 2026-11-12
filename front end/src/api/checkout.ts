/**
 * Stripe checkout session lifecycle.
 * {@link startCheckout} creates a hosted Checkout URL; success/cancel endpoints
 * finalize or abandon the pending payment after the customer returns from Stripe.
 */
import type { CheckoutBody, CheckoutSuccessData } from '../types/api';
import { api } from './client';

/**
 * Create a Stripe Checkout session and return the hosted payment URL.
 *
 * @param body - Order/reservation identifiers and any checkout options required by the API.
 * @returns Object containing `checkoutUrl` for redirecting the browser to Stripe.
 * @remarks Side effect: creates a pending Stripe session on the server.
 */
export async function startCheckout(body: CheckoutBody): Promise<{ checkoutUrl: string }> {
  return api<{ checkoutUrl: string }>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Confirm payment after Stripe redirects back with `session_id`.
 *
 * @param sessionId - Stripe Checkout Session id from the success redirect query string.
 * @returns Finalized checkout payload (reservation/order confirmation data).
 * @remarks The session id is query-encoded because it may contain URL-sensitive characters.
 */
export async function checkoutSuccess(sessionId: string): Promise<CheckoutSuccessData> {
  return api<CheckoutSuccessData>(`/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`);
}

/**
 * Notify the backend that the customer abandoned Stripe Checkout.
 *
 * @returns Cancellation acknowledgement plus support contact copy for the cancel page.
 * @remarks Side effect: may release holds / mark the pending payment as cancelled server-side.
 */
export async function checkoutCancel(): Promise<{
  cancelled: boolean;
  message: string;
  supportEmail: string;
}> {
  return api('/api/checkout/cancel', { method: 'POST' });
}
