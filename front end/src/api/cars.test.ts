import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('./client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { buildSearchQuery, getCar, getCars, searchCars } from './cars';

describe('cars API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('getCars calls /api/cars with filter query params', async () => {
    mockApi.mockResolvedValue({ cars: [], pagination: {} });
    await getCars({ page: 2, categoryId: 3, transmission: 'auto' });

    expect(mockApi).toHaveBeenCalledWith('/api/cars?page=2&categoryId=3&transmission=auto');
  });

  it('getCars calls /api/cars without query when no filters', async () => {
    mockApi.mockResolvedValue({ cars: [] });
    await getCars();

    expect(mockApi).toHaveBeenCalledWith('/api/cars');
  });

  it('searchCars builds search query string', async () => {
    mockApi.mockResolvedValue({ cars: [] });
    const search = {
      pickupLocation: 'airport' as const,
      returnLocation: 'downtown' as const,
      pickupDate: '2026-07-10',
      returnDate: '2026-07-15',
      pickupTime: '10:00',
      returnTime: '18:00',
    };

    await searchCars(search, { page: 1 });

    const url = mockApi.mock.calls[0][0] as string;
    expect(url).toMatch(/^\/api\/cars\/search\?/);
    expect(url).toContain('pickup-date=2026-07-10');
    expect(url).toContain('return-location=downtown');
    expect(url).toContain('page=1');
  });

  it('getCar fetches a single car by id', async () => {
    mockApi.mockResolvedValue({ car: { id: '42' } });
    await getCar('42');

    expect(mockApi).toHaveBeenCalledWith('/api/cars/42');
  });

  it('buildSearchQuery merges search and filter params', () => {
    const params = buildSearchQuery(
      {
        pickupLocation: 'airport',
        returnLocation: 'airport',
        pickupDate: '2026-07-01',
        returnDate: '2026-07-05',
        pickupTime: '09:00',
        returnTime: '17:00',
      },
      { fuelType: 'electric' },
    );

    expect(params.get('pickup-location')).toBe('airport');
    expect(params.get('fuelType')).toBe('electric');
  });
});
