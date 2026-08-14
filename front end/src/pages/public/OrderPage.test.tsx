import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrder } from '../../api/orders';
import { buildTestSearchQuery, renderWithRouter } from '../../test/test-utils';
import type { OrderPageData } from '../../types/api';
import { OrderPage } from './OrderPage';

vi.mock('../../api/orders', () => ({ createOrder: vi.fn() }));
vi.mock('../../api/reservations', () => ({
  releaseReservation: vi.fn(),
  releaseAndRehold: vi.fn(),
}));

const mockOrder: OrderPageData = {
  title: 'Review',
  car: {
    id: '1',
    name: 'VW Golf',
    image: '/cars/golf.jpg',
    transmission: 'Manual',
    fuelType: 'Petrol',
    seats: 5,
    availability: true,
    category: 'Economy',
  },
  pickupDate: '2026-07-10',
  pickupTime: '10:00',
  returnDate: '2026-07-12',
  returnTime: '10:00',
  pickupLocation: 'office',
  returnLocation: 'office',
  pickupLocationDisplay: 'Office',
  returnLocationDisplay: 'Office',
  pickupDateISO: '2026-07-10',
  returnDateISO: '2026-07-12',
  rentalDays: 2,
  deliveryPrice: 20,
  returnPrice: 20,
  totalPrice: 220,
  fullName: '',
  phoneNumber: '',
  email: '',
  address: '',
  hotelName: '',
  existingReservation: null,
  releaseRedirect: '',
  message: null,
};

describe('OrderPage', () => {
  beforeEach(() => {
    vi.mocked(createOrder).mockResolvedValue(mockOrder);
  });

  it('renders booking review', async () => {
    renderWithRouter(<OrderPage />, {
      route: `/order/1?${buildTestSearchQuery()}`,
      path: '/order/:carId',
    });

    await waitFor(() => {
      expect(screen.getByText('Review your booking')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Continue to checkout' })).toBeInTheDocument();
  });
});
