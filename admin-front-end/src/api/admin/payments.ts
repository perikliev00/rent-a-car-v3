/**
 * Payment ops APIs: event/failure ledger, reconcile, and refund queue.
 */
import type { PaymentEventRow, PaymentFailureRow } from '../../types/api';
// Contribute this line to the enclosing declaration or statement.
import type { OpsReservationRow } from './reservations';
// Import named exports from '../client'.
import { api } from '../client';

/**
 * Payment events, failures, and unresolved-failure count for the Payments page.
 */
export async function getPayments(): Promise<{
  // Provide the events field value.
  events: PaymentEventRow[];
  // Provide the failures field value.
  failures: PaymentFailureRow[];
  // Provide the unresolved failure count field value.
  unresolvedFailureCount: number;
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api('/api/admin/payments');
}

/**
 * Syncs gateway state; `dryRun` reports without writing.
 * @param dryRun - When true, reconcile reports only (default false)
 */
export async function reconcilePayments(dryRun = false): Promise<{ ok: boolean; dryRun: boolean }> {
  // Return the resulting value to the caller.
  return api('/api/admin/payments/reconcile', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify({ dryRun }),
  });
}

// Export the payment refund queue filters interface.
export interface PaymentRefundQueueFilters {
  // Contribute this line to the enclosing declaration or statement.
  q?: string;
  // Contribute this line to the enclosing declaration or statement.
  status?: string;
  // Contribute this line to the enclosing declaration or statement.
  refundState?: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupFrom?: string;
  // Contribute this line to the enclosing declaration or statement.
  pickupTo?: string;
  // Contribute this line to the enclosing declaration or statement.
  limit?: number;
}

// Export the payment refund queue data interface.
export interface PaymentRefundQueueData {
  // Provide the refundable field value.
  refundable: OpsReservationRow[];
  // Provide the recent refunds field value.
  recentRefunds: OpsReservationRow[];
  // Provide the limit field value.
  limit: number;
}

/**
 * Refundable reservations plus recent refund activity for the payments page.
 * Empty filter values are omitted from the query string.
 *
 * @param filters - Search/status/date/limit controls from the UI
 */
export async function getPaymentRefundQueue(
  // Provide the filters field value.
  filters: PaymentRefundQueueFilters = {}
// Continue the surrounding logic with this statement.
): Promise<PaymentRefundQueueData> {
  // Create the params constant.
  const params = new URLSearchParams();
  // Evaluate the condition and enter the branch when it is true.
  if (filters.q) params.set('q', filters.q);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.status) params.set('status', filters.status);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.refundState) params.set('refundState', filters.refundState);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.pickupFrom) params.set('pickupFrom', filters.pickupFrom);
  // Evaluate the condition and enter the branch when it is true.
  if (filters.pickupTo) params.set('pickupTo', filters.pickupTo);
  // Keep numeric `0` if ever passed (`!= null`).
  if (filters.limit != null) params.set('limit', String(filters.limit));
  // Create the qs constant.
  const qs = params.toString();
  // Return the resulting value to the caller.
  return api(`/api/admin/payments/refund-queue${qs ? `?${qs}` : ''}`);
}
