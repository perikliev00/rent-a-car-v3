/**
 * Stripe checkout session lifecycle.
 * {@link startCheckout} creates a hosted Checkout URL; success/cancel endpoints
 * finalize or abandon the pending payment after the customer returns from Stripe.
 */
import type { CheckoutBody, CheckoutSuccessData } from '../types/api';
// Import named exports from './client'.
import { api } from './client';

/**
 * Create a Stripe Checkout session and return the hosted payment URL.
 *
 * @param body - Order/reservation identifiers and any checkout options required by the API.
 * @returns Object containing `checkoutUrl` for redirecting the browser to Stripe.
 * @remarks Side effect: creates a pending Stripe session on the server.
 */
export async function startCheckout(body: CheckoutBody): Promise<{ checkoutUrl: string }> {
  // Return the resulting value to the caller.
  return api<{ checkoutUrl: string }>('/api/checkout', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
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
  // Return the resulting value to the caller.
  return api<CheckoutSuccessData>(`/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`);
}

/**
 * Notify the backend that the customer abandoned Stripe Checkout.
 *
 * @returns Cancellation acknowledgement plus support contact copy for the cancel page.
 * @remarks Side effect: may release holds / mark the pending payment as cancelled server-side.
 */
export async function checkoutCancel(): Promise<{
  // Provide the cancelled field value.
  cancelled: boolean;
  // Provide the message field value.
  message: string;
  // Provide the support email field value.
  supportEmail: string;
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api('/api/checkout/cancel', { method: 'POST' });
}
