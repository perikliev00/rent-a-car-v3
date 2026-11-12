import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('./client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { createOrder } from './orders';

describe('orders API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('createOrder posts order body to /api/orders', async () => {
    const body = {
      carId: '7',
      pickupDate: '2026-07-10',
      returnDate: '2026-07-12',
      pickupLocation: 'airport',
      returnLocation: 'airport',
      fullName: 'Jane Doe',
      phoneNumber: '+1234567890',
      email: 'jane@example.com',
      address: '123 Main St',
    };
    const orderData = { order: { id: 1 }, car: { id: '7' } };
    mockApi.mockResolvedValue(orderData);

    const result = await createOrder(body);

    expect(mockApi).toHaveBeenCalledWith('/api/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    expect(result).toEqual(orderData);
  });
});
