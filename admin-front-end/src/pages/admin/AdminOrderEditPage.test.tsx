import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminOrderEdit } from '../../api/admin/orders';
import { getLocations } from '../../api/locations';
import { renderWithRouter } from '../../test/test-utils';
import { AdminOrderEditPage } from './AdminOrderEditPage';

vi.mock('../../api/admin/orders', () => ({
  getAdminOrderEdit: vi.fn(),
  updateAdminOrder: vi.fn(),
}));
vi.mock('../../api/locations', () => ({ getLocations: vi.fn() }));

describe('AdminOrderEditPage', () => {
  beforeEach(() => {
    vi.mocked(getAdminOrderEdit).mockResolvedValue({
      order: {
        id: '42',
        carId: '1',
        pickupDate: '2026-07-10',
        pickupTime: '10:00',
        returnDate: '2026-07-12',
        returnTime: '10:00',
        pickupLocation: 'office',
        returnLocation: 'office',
        rentalDays: 2,
        deliveryPrice: 20,
        returnPrice: 20,
        totalPrice: 220,
        fullName: 'Jane Doe',
        phoneNumber: '+359888000000',
        email: 'jane@example.com',
        address: 'Sunny Beach',
        status: 'pending',
        isDeleted: false,
      },
      cars: [],
      pickupDateISO: '2026-07-10',
      returnDateISO: '2026-07-12',
      pickupTimeHHMM: '10:00',
      returnTimeHHMM: '10:00',
    });
    vi.mocked(getLocations).mockResolvedValue({
      locations: [{ id: 'office', label: 'Office' }],
    });
  });

  it('renders edit order form', async () => {
    renderWithRouter(<AdminOrderEditPage />, {
      route: '/admin/orders/42/edit',
      path: '/admin/orders/:id/edit',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Edit order #42' })).toBeInTheDocument();
    });
  });
});
