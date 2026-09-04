import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminOrder } from '../../api/admin/orders';
import { renderWithRouter } from '../../test/test-utils';
import { AdminOrderDetailPage } from './AdminOrderDetailPage';

vi.mock('../../api/admin/orders', () => ({ getAdminOrder: vi.fn() }));

describe('AdminOrderDetailPage', () => {
  beforeEach(() => {
    vi.mocked(getAdminOrder).mockResolvedValue({
      order: {
        id: '42',
        carId: {
          id: '1',
          name: 'BMW 320',
          image: '/cars/bmw.jpg',
          transmission: 'Automatic',
          fuelType: 'Petrol',
          seats: 5,
          availability: true,
          category: 'Premium',
        },
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
    });
  });

  it('renders order details', async () => {
    renderWithRouter(<AdminOrderDetailPage />, {
      route: '/admin/orders/42',
      path: '/admin/orders/:id',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Order #42' })).toBeInTheDocument();
    });

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });
});
