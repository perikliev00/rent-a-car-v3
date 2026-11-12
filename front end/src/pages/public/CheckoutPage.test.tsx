// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/orders'.
import { createOrder } from '../../api/orders';
// Import named exports from '../../api/checkout'.
import { startCheckout } from '../../api/checkout';
// Import named exports from '../../test/test-utils'.
import { buildTestSearchQuery, renderWithRouter } from '../../test/test-utils';
// Contribute this line to the enclosing declaration or statement.
import type { OrderPageData } from '../../types/api';
// Import named exports from './CheckoutPage'.
import { CheckoutPage } from './CheckoutPage';

// Call vi.mock to perform this step.
vi.mock('../../api/orders', () => ({ createOrder: vi.fn() }));
// Call vi.mock to perform this step.
vi.mock('../../api/checkout', () => ({ startCheckout: vi.fn() }));

// Continue the surrounding logic with this statement.
const mockOrder: OrderPageData = {
  // Provide the title field value.
  title: 'Checkout',
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
describe('CheckoutPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(createOrder).mockResolvedValue(mockOrder);
    // Call vi.mocked to perform this step.
    vi.mocked(startCheckout).mockResolvedValue({ checkoutUrl: 'https://stripe.test/checkout' });
  });

  // Define a single test case and its expectations.
  it('renders checkout form', async () => {
    renderWithRouter(<CheckoutPage />, {
      // Provide the route field value.
      route: `/checkout/1?${buildTestSearchQuery()}`,
      // Provide the path field value.
      path: '/checkout/:carId',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Checkout' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Pay with Stripe' })).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('shows load error instead of spinning forever when order preview fails', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(createOrder).mockRejectedValue(new Error('Selected car is already booked'));

    renderWithRouter(<CheckoutPage />, {
      // Provide the route field value.
      route: `/checkout/1?${buildTestSearchQuery()}`,
      // Provide the path field value.
      path: '/checkout/:carId',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByTestId('checkout-load-error')).toHaveTextContent(
        // Supply the literal value used by the enclosing expression.
        'Selected car is already booked'
      );
    });
    // Assert that the value matches the intended expectation.
    expect(screen.queryByLabelText('Full name')).not.toBeInTheDocument();
  });
});
