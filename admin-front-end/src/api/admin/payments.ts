/**
 * Payment ops APIs: event/failure ledger, reconcile, and refund queue.
 */
import type { PaymentEventRow, PaymentFailureRow } from '../../types/api';
import type { OpsReservationRow } from './reservations';
import { api } from '../client';

/**
 * Payment events, failures, and unresolved-failure count for the Payments page.
 */
export async function getPayments(): Promise<{
  events: PaymentEventRow[];
  failures: PaymentFailureRow[];
  unresolvedFailureCount: number;
}> {
  return api('/api/admin/payments');
}

/**
 * Syncs gateway state; `dryRun` reports without writing.
 * @param dryRun - When true, reconcile reports only (default false)
 */
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

/**
 * Refundable reservations plus recent refund activity for the payments page.
 * Empty filter values are omitted from the query string.
 *
 * @param filters - Search/status/date/limit controls from the UI
 */
export async function getPaymentRefundQueue(
  filters: PaymentRefundQueueFilters = {}
): Promise<PaymentRefundQueueData> {
  const params = new URLSearchParams();
  if (filters.q) params.set('q', filters.q);
  if (filters.status) params.set('status', filters.status);
  if (filters.refundState) params.set('refundState', filters.refundState);
  if (filters.pickupFrom) params.set('pickupFrom', filters.pickupFrom);
  if (filters.pickupTo) params.set('pickupTo', filters.pickupTo);
  // Keep numeric `0` if ever passed (`!= null`).
  if (filters.limit != null) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return api(`/api/admin/payments/refund-queue${qs ? `?${qs}` : ''}`);
}
