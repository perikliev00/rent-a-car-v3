import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('./client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { getCategories, getLocations, getPricingInfo } from './locations';

describe('locations API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('getLocations fetches /api/locations', async () => {
    const data = { locations: [], deliveryFees: {}, returnFees: {} };
    mockApi.mockResolvedValue(data);

    const result = await getLocations();

    expect(mockApi).toHaveBeenCalledWith('/api/locations');
    expect(result).toEqual(data);
  });

  it('getPricingInfo fetches /api/pricing-info', async () => {
    mockApi.mockResolvedValue({ deliveryFees: {}, returnFees: {}, priceTierExplanation: {} });
    await getPricingInfo();

    expect(mockApi).toHaveBeenCalledWith('/api/pricing-info');
  });

  it('getCategories fetches /api/categories', async () => {
    mockApi.mockResolvedValue({ categories: [{ id: 1, name: 'SUV' }] });

    const result = await getCategories();

    expect(mockApi).toHaveBeenCalledWith('/api/categories');
    expect(result.categories[0].name).toBe('SUV');
  });
});
