import type { PaymentEventRow, PaymentFailureRow } from '../../types/api';
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
