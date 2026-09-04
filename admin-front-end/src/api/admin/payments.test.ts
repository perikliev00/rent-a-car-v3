import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('../client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { getPayments, reconcilePayments, getPaymentRefundQueue } from './payments';

describe('admin payments API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('getPayments fetches /api/admin/payments', async () => {
    const data = { events: [], failures: [], unresolvedFailureCount: 0 };
    mockApi.mockResolvedValue(data);

    const result = await getPayments();

    expect(mockApi).toHaveBeenCalledWith('/api/admin/payments');
    expect(result).toEqual(data);
  });

  it('reconcilePayments posts dryRun flag defaulting to false', async () => {
    mockApi.mockResolvedValue({ ok: true, dryRun: false });
    await reconcilePayments();

    expect(mockApi).toHaveBeenCalledWith('/api/admin/payments/reconcile', {
      method: 'POST',
      body: JSON.stringify({ dryRun: false }),
    });
  });

  it('reconcilePayments passes dryRun true when requested', async () => {
    mockApi.mockResolvedValue({ ok: true, dryRun: true });
    await reconcilePayments(true);

    expect(mockApi).toHaveBeenCalledWith('/api/admin/payments/reconcile', {
      method: 'POST',
      body: JSON.stringify({ dryRun: true }),
    });
  });

  it('getPaymentRefundQueue fetches queue with filters', async () => {
    const data = { refundable: [], recentRefunds: [], limit: 50 };
    mockApi.mockResolvedValue(data);

    const result = await getPaymentRefundQueue({
      q: '512',
      status: 'confirmed',
      refundState: 'none',
      pickupFrom: '2026-08-01',
      pickupTo: '2026-08-31',
    });

    expect(mockApi).toHaveBeenCalledWith(
      '/api/admin/payments/refund-queue?q=512&status=confirmed&refundState=none&pickupFrom=2026-08-01&pickupTo=2026-08-31'
    );
    expect(result).toEqual(data);
  });
});
