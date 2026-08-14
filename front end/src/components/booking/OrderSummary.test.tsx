import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { OrderPageData } from '../../types/api';
import { renderWithRouter } from '../../test/test-utils';
import { OrderSummary } from './OrderSummary';

const mockOrder: OrderPageData = {
  title: 'Review',
  car: {
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

describe('OrderSummary', () => {
  it('renders booking summary details', () => {
    renderWithRouter(<OrderSummary order={mockOrder} />);

    expect(screen.getByText('Booking summary')).toBeInTheDocument();
    expect(screen.getByText('BMW 320')).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
  });
});
