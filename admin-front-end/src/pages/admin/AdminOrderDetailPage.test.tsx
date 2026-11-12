// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/orders'.
import { getAdminOrder } from '../../api/admin/orders';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminOrderDetailPage'.
import { AdminOrderDetailPage } from './AdminOrderDetailPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/orders', () => ({ getAdminOrder: vi.fn() }));

// Declare a test suite grouping related cases.
describe('AdminOrderDetailPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getAdminOrder).mockResolvedValue({
      // Provide the order field value.
      order: {
        // Provide the id field value.
        id: '42',
        // Provide the car id field value.
        carId: {
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
        // Provide the rental days field value.
        rentalDays: 2,
        // Provide the delivery price field value.
        deliveryPrice: 20,
        // Provide the return price field value.
        returnPrice: 20,
        // Provide the total price field value.
        totalPrice: 220,
        // Provide the full name field value.
        fullName: 'Jane Doe',
        // Provide the phone number field value.
        phoneNumber: '+359888000000',
        // Provide the email field value.
        email: 'jane@example.com',
        // Provide the address field value.
        address: 'Sunny Beach',
        // Provide the status field value.
        status: 'pending',
        // Provide the is deleted field value.
        isDeleted: false,
      },
    });
  });

  // Define a single test case and its expectations.
  it('renders order details', async () => {
    renderWithRouter(<AdminOrderDetailPage />, {
      // Provide the route field value.
      route: '/admin/orders/42',
      // Provide the path field value.
      path: '/admin/orders/:id',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Order #42' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });
});
