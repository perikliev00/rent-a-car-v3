import type { PaymentEventRow, PaymentFailureRow } from '../../types/api';
import type { OpsReservationRow } from './reservations';
import { api } from '../client';

export async function getPayments(): Promise<{
  events: PaymentEventRow[];
  failures: PaymentFailureRow[];
  unresolvedFailureCount: number;
}> {
  return api('/api/admin/payments');
}

export async function reconcilePayments(dryRun = false): Promise<{ ok: boolean; dryRun: boolean }> {
  return api('/api/admin/payments/reconcile', {
    method: 'POST',
    body: JSON.stringify({ dryRun }),
  });
}

export interface PaymentRefundQueueFilters {
  q?: string;
  status?: string;
  refundState?: string;
  pickupFrom?: string;
  pickupTo?: string;
  limit?: number;
}

export interface PaymentRefundQueueData {
  refundable: OpsReservationRow[];
  recentRefunds: OpsReservationRow[];
  limit: number;
}

export async function getPaymentRefundQueue(
  filters: PaymentRefundQueueFilters = {}
): Promise<PaymentRefundQueueData> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.refundState) params.set('refundState', filters.refundState);
  if (filters.pickupFrom) params.set('pickupFrom', filters.pickupFrom);
  if (filters.pickupTo) params.set('pickupTo', filters.pickupTo);
  if (filters.limit != null) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return api(`/api/admin/payments/refund-queue${qs ? `?${qs}` : ''}`);
}
