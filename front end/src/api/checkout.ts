import type { CheckoutBody, CheckoutSuccessData } from '../types/api';
import { api } from './client';

export async function startCheckout(body: CheckoutBody): Promise<{ checkoutUrl: string }> {
  return api<{ checkoutUrl: string }>('/api/checkout', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function checkoutSuccess(sessionId: string): Promise<CheckoutSuccessData> {
  return api<CheckoutSuccessData>(`/api/checkout/success?session_id=${encodeURIComponent(sessionId)}`);
}

export async function checkoutCancel(): Promise<{
  cancelled: boolean;
  message: string;
  supportEmail: string;
}> {
  return api('/api/checkout/cancel', { method: 'POST' });
}
