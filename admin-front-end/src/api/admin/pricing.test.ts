import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('../client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import {
  createSeason,
  deleteExtra,
  getAdminPricing,
  previewPricing,
  updateDeliveryFees,
  updateDeposit,
} from './pricing';

describe('admin pricing API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('getAdminPricing fetches /api/admin/pricing', async () => {
    const data = { pricing: { seasons: [], extras: [] } };
    mockApi.mockResolvedValue(data);

    const result = await getAdminPricing();

    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing');
    expect(result).toEqual(data);
  });

  it('updateDeliveryFees puts fees payload', async () => {
    mockApi.mockResolvedValue({ deliveryFees: [] });
    await updateDeliveryFees([{ locationId: 'office', fee: 0 }]);

    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/delivery-fees', {
      method: 'PUT',
      body: JSON.stringify({ fees: [{ locationId: 'office', fee: 0 }] }),
    });
  });

  it('createSeason posts season body', async () => {
    mockApi.mockResolvedValue({ season: { id: 1 } });
    await createSeason({
      name: 'Summer',
      startMonth: 6,
      startDay: 1,
      endMonth: 8,
      endDay: 31,
      adjType: 'percent',
      adjValue: 10,
      active: true,
    });

    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/seasons', {
      method: 'POST',
      body: expect.stringContaining('"name":"Summer"'),
    });
  });

  it('updateDeposit puts deposit payload', async () => {
    mockApi.mockResolvedValue({ depositRule: { id: 1, defaultAmount: 200 } });
    await updateDeposit({ id: 1, defaultAmount: 200, name: 'Standard' });

    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/deposit', {
      method: 'PUT',
      body: JSON.stringify({ id: 1, defaultAmount: 200, name: 'Standard' }),
    });
  });

  it('deleteExtra deletes by id', async () => {
    mockApi.mockResolvedValue({ deleted: true });
    await deleteExtra(4);

    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/extras/4', { method: 'DELETE' });
  });

  it('previewPricing posts preview body', async () => {
    mockApi.mockResolvedValue({ car: { id: 1 }, pricing: { totalPrice: 100 } });
    await previewPricing({
      carId: 1,
      pickupDate: '2026-08-10',
      returnDate: '2026-08-12',
      pickupLocation: 'office',
      returnLocation: 'office',
    });

    expect(mockApi).toHaveBeenCalledWith('/api/admin/pricing/preview', {
      method: 'POST',
      body: expect.stringContaining('"carId":1'),
    });
  });
});
