import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('../client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import {
  createAdminOrder,
  deleteAdminOrder,
  getAdminOrders,
  getDashboard,
  restoreAdminOrder,
} from './orders';

describe('admin orders API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('getDashboard fetches /api/admin/dashboard', async () => {
    const data = { orders: [], stats: { totalOrders: 0, totalRevenue: '0', pendingOrders: 0 } };
    mockApi.mockResolvedValue(data);

    const result = await getDashboard();

    expect(mockApi).toHaveBeenCalledWith('/api/admin/dashboard');
    expect(result).toEqual(data);
  });

  it('getAdminOrders appends filter query params', async () => {
    mockApi.mockResolvedValue({ orders: [], filters: {} });
    await getAdminOrders({
      status: 'pending',
      startDate: '2026-07-01',
      search: 'john',
    });

    const url = mockApi.mock.calls[0][0] as string;
    expect(url).toContain('status=pending');
    expect(url).toContain('startDate=2026-07-01');
    expect(url).toContain('search=john');
  });

  it('createAdminOrder posts body to /api/admin/orders', async () => {
    const body = {
      carId: '1',
      pickupDate: '2026-07-10',
      returnDate: '2026-07-12',
      pickupLocation: 'airport',
      returnLocation: 'airport',
      fullName: 'Admin User',
      phoneNumber: '+999',
      email: 'admin@example.com',
      address: 'HQ',
    };
    mockApi.mockResolvedValue({ created: true });

    await createAdminOrder(body);

    expect(mockApi).toHaveBeenCalledWith('/api/admin/orders', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  });

  it('deleteAdminOrder sends DELETE to order id', async () => {
    mockApi.mockResolvedValue({ deleted: true, id: 12 });
    await deleteAdminOrder('12');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/orders/12', { method: 'DELETE' });
  });

  it('restoreAdminOrder posts to restore endpoint', async () => {
    mockApi.mockResolvedValue({ restored: true, id: 12 });
    await restoreAdminOrder('12');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/orders/12/restore', { method: 'POST' });
  });
});
