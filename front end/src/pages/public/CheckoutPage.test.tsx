import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createOrder } from '../../api/orders';
import { startCheckout } from '../../api/checkout';
import { buildTestSearchQuery, renderWithRouter } from '../../test/test-utils';
import type { OrderPageData } from '../../types/api';
import { CheckoutPage } from './CheckoutPage';

vi.mock('../../api/orders', () => ({ createOrder: vi.fn() }));
vi.mock('../../api/checkout', () => ({ startCheckout: vi.fn() }));

const mockOrder: OrderPageData = {
  title: 'Checkout',
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

describe('CheckoutPage', () => {
  beforeEach(() => {
    vi.mocked(createOrder).mockResolvedValue(mockOrder);
    vi.mocked(startCheckout).mockResolvedValue({ checkoutUrl: 'https://stripe.test/checkout' });
  });

  it('renders checkout form', async () => {
    renderWithRouter(<CheckoutPage />, {
      route: `/checkout/1?${buildTestSearchQuery()}`,
      path: '/checkout/:carId',
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pay with Stripe' })).toBeInTheDocument();
  });
});
