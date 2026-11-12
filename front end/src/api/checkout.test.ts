import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('./client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { checkoutCancel, checkoutSuccess, startCheckout } from './checkout';

describe('checkout API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('startCheckout posts body to /api/checkout', async () => {
    const body = { orderId: 99 };
    mockApi.mockResolvedValue({ checkoutUrl: 'https://pay.example/session' });

    const result = await startCheckout(body);

    expect(mockApi).toHaveBeenCalledWith('/api/checkout', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    expect(result.checkoutUrl).toContain('https://');
  });

  it('checkoutSuccess encodes session_id in query string', async () => {
    mockApi.mockResolvedValue({ orderId: 1, status: 'paid' });
    await checkoutSuccess('sess/id+special');

    expect(mockApi).toHaveBeenCalledWith('/api/checkout/success?session_id=sess%2Fid%2Bspecial');
  });

  it('checkoutCancel posts to /api/checkout/cancel', async () => {
    const payload = {
      cancelled: true,
      message: 'Payment cancelled',
      supportEmail: 'help@example.com',
    };
    mockApi.mockResolvedValue(payload);

    const result = await checkoutCancel();

    expect(mockApi).toHaveBeenCalledWith('/api/checkout/cancel', { method: 'POST' });
    expect(result).toEqual(payload);
  });
});
