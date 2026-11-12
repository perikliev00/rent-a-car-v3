// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/orders'.
import { getAdminOrderEdit } from '../../api/admin/orders';
// Import named exports from '../../api/locations'.
import { getLocations } from '../../api/locations';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminOrderEditPage'.
import { AdminOrderEditPage } from './AdminOrderEditPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/orders', () => ({
  // Provide the get admin order edit field value.
  getAdminOrderEdit: vi.fn(),
  // Provide the update admin order field value.
  updateAdminOrder: vi.fn(),
}));
// Call vi.mock to perform this step.
vi.mock('../../api/locations', () => ({ getLocations: vi.fn() }));

// Declare a test suite grouping related cases.
describe('AdminOrderEditPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getAdminOrderEdit).mockResolvedValue({
      // Provide the order field value.
      order: {
        // Provide the id field value.
        id: '42',
        // Provide the car id field value.
        carId: '1',
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
      // Provide the cars field value.
      cars: [],
      // Provide the pickup date iso field value.
      pickupDateISO: '2026-07-10',
      // Provide the return date iso field value.
      returnDateISO: '2026-07-12',
      // Provide the pickup time hhmm field value.
      pickupTimeHHMM: '10:00',
      // Provide the return time hhmm field value.
      returnTimeHHMM: '10:00',
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getLocations).mockResolvedValue({
      // Provide the locations field value.
      locations: [{ id: 'office', label: 'Office' }],
    });
  });

  // Define a single test case and its expectations.
  it('renders edit order form', async () => {
    renderWithRouter(<AdminOrderEditPage />, {
      // Provide the route field value.
      route: '/admin/orders/42/edit',
      // Provide the path field value.
      path: '/admin/orders/:id/edit',
    });

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Edit order #42' })).toBeInTheDocument();
    });
  });
});
