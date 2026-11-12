// Import named exports from 'react'.
import { StrictMode } from 'react';
// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/client'.
import { ApiError } from '../../api/client';
// Import named exports from '../../api/orders'.
import { createOrder } from '../../api/orders';
// Import named exports from '../../test/test-utils'.
import { buildTestSearchQuery, renderWithRouter } from '../../test/test-utils';
// Contribute this line to the enclosing declaration or statement.
import type { OrderPageData } from '../../types/api';
// Import named exports from './OrderPage'.
import { OrderPage } from './OrderPage';

// Call vi.mock to perform this step.
vi.mock('../../api/orders', () => ({ createOrder: vi.fn() }));
// Call vi.mock to perform this step.
vi.mock('../../api/reservations', () => ({
  // Provide the release reservation field value.
  releaseReservation: vi.fn(),
  // Provide the release and rehold field value.
  releaseAndRehold: vi.fn(),
}));

// Continue the surrounding logic with this statement.
const mockOrder: OrderPageData = {
  // Provide the title field value.
  title: 'Review',
  // Provide the car field value.
  car: {
    // Provide the id field value.
    id: '1',
    // Provide the name field value.
    name: 'VW Golf',
    // Provide the image field value.
    image: '/cars/golf.jpg',
    // Provide the transmission field value.
    transmission: 'Manual',
    // Provide the fuel type field value.
    fuelType: 'Petrol',
    // Provide the seats field value.
    seats: 5,
    // Provide the availability field value.
    availability: true,
    // Provide the category field value.
    category: 'Economy',
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
describe('OrderPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(createOrder).mockResolvedValue(mockOrder);
  });

  // Define a single test case and its expectations.
  it('renders booking review', async () => {
    renderWithRouter(<OrderPage />, {
      // Provide the route field value.
      route: `/order/1?${buildTestSearchQuery()}`,
      // Provide the path field value.
      path: '/order/:carId',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('Review your booking')).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Continue to checkout' })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('keeps review when a later duplicate createOrder returns CONFLICT', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(createOrder)
      // Call .mockResolvedValueOnce to perform this step.
      .mockResolvedValueOnce(mockOrder)
      // Call .mockRejectedValueOnce to perform this step.
      .mockRejectedValueOnce(
        // Continue the surrounding logic with this statement.
        new ApiError(
          // Supply the literal value used by the enclosing expression.
          'CONFLICT',
          // Supply the literal value used by the enclosing expression.
          'Selected car is already reserved in this period. Please choose different dates or a different car.',
          // Supply the literal value used by the enclosing expression.
          409
        )
      );

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <StrictMode>
        <OrderPage />
      </StrictMode>,
      {
        // Provide the route field value.
        route: `/order/1?${buildTestSearchQuery()}`,
        // Provide the path field value.
        path: '/order/:carId',
      }
    );

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('Review your booking')).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('button', { name: 'Release existing reservation' })).not.toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Continue to checkout' })).toBeInTheDocument();
  });
});
