import { StrictMode } from 'react';
import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../api/client';
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

  it('keeps review when a later duplicate createOrder returns CONFLICT', async () => {
    vi.mocked(createOrder)
      .mockResolvedValueOnce(mockOrder)
      .mockRejectedValueOnce(
        new ApiError(
          'CONFLICT',
          'Selected car is already reserved in this period. Please choose different dates or a different car.',
          409
        )
      );

    renderWithRouter(
      <StrictMode>
        <OrderPage />
      </StrictMode>,
      {
        route: `/order/1?${buildTestSearchQuery()}`,
        path: '/order/:carId',
      }
    );

    await waitFor(() => {
      expect(screen.getByText('Review your booking')).toBeInTheDocument();
    });

    expect(screen.queryByRole('button', { name: 'Release existing reservation' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continue to checkout' })).toBeInTheDocument();
  });
});
