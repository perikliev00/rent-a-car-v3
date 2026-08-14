import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('./client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { releaseAndRehold, releaseReservation } from './reservations';

describe('reservations API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('releaseReservation posts to /api/reservations/release', async () => {
    mockApi.mockResolvedValue({ released: true });

    const result = await releaseReservation();

    expect(mockApi).toHaveBeenCalledWith('/api/reservations/release', { method: 'POST' });
    expect(result).toEqual({ released: true });
  });

  it('releaseAndRehold posts order body to release-and-rehold', async () => {
    const body = {
      carId: '3',
      pickupDate: '2026-08-01',
      returnDate: '2026-08-05',
      pickupLocation: 'airport',
      returnLocation: 'downtown',
      fullName: 'Alex',
      phoneNumber: '+111',
      email: 'alex@example.com',
      address: '1 Road',
    };
    mockApi.mockResolvedValue({ reheld: true });

    const result = await releaseAndRehold(body);

    expect(mockApi).toHaveBeenCalledWith('/api/reservations/release-and-rehold', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    expect(result).toEqual({ reheld: true });
  });
});
