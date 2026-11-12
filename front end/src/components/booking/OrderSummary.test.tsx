// Import named exports from '@testing-library/react'.
import { screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Contribute this line to the enclosing declaration or statement.
import type { OrderPageData } from '../../types/api';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './OrderSummary'.
import { OrderSummary } from './OrderSummary';

// Continue the surrounding logic with this statement.
const mockOrder: OrderPageData = {
  // Provide the title field value.
  title: 'Review',
  // Provide the car field value.
  car: {
    // Provide the id field value.
    id: '1',
    // Provide the name field value.
    name: 'BMW 320',
    // Provide the image field value.
    image: '/cars/bmw.jpg',
    // Provide the transmission field value.
    transmission: 'Automatic',
    // Provide the fuel type field value.
    fuelType: 'Petrol',
    // Provide the seats field value.
    seats: 5,
    // Provide the availability field value.
    availability: true,
    // Provide the category field value.
    category: 'Premium',
  },
  // Provide the pickup date field value.
  pickupDate: '2026-07-10',
  // Provide the pickup time field value.
  pickupTime: '10:00',
  // Provide the return date field value.
  returnDate: '2026-07-12',
  // Provide the return time field value.
  returnTime: '10:00',
  // Provide the pickup location field value.
  pickupLocation: 'office',
  // Provide the return location field value.
  returnLocation: 'office',
  // Provide the pickup location display field value.
  pickupLocationDisplay: 'Office',
  // Provide the return location display field value.
  returnLocationDisplay: 'Office',
  // Provide the pickup date iso field value.
  pickupDateISO: '2026-07-10',
  // Provide the return date iso field value.
  returnDateISO: '2026-07-12',
  // Provide the rental days field value.
  rentalDays: 2,
  // Provide the delivery price field value.
  deliveryPrice: 20,
  // Provide the return price field value.
  returnPrice: 20,
  // Provide the total price field value.
  totalPrice: 220,
  // Provide the full name field value.
  fullName: '',
  // Provide the phone number field value.
  phoneNumber: '',
  // Provide the email field value.
  email: '',
  // Provide the address field value.
  address: '',
  // Provide the hotel name field value.
  hotelName: '',
  // Provide the existing reservation field value.
  existingReservation: null,
  // Provide the release redirect field value.
  releaseRedirect: '',
  // Provide the message field value.
  message: null,
};

// Declare a test suite grouping related cases.
describe('OrderSummary', () => {
  // Define a single test case and its expectations.
  it('renders booking summary details', () => {
    renderWithRouter(<OrderSummary order={mockOrder} />);

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Booking summary')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('BMW 320')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Total')).toBeInTheDocument();
  });
});
