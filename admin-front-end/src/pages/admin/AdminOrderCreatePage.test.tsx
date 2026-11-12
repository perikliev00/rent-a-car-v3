// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/orders'.
import { getNewOrderForm } from '../../api/admin/orders';
// Import named exports from '../../api/locations'.
import { getLocations } from '../../api/locations';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminOrderCreatePage'.
import { AdminOrderCreatePage } from './AdminOrderCreatePage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/orders', () => ({
  // Provide the get new order form field value.
  getNewOrderForm: vi.fn(),
  // Provide the create admin order field value.
  createAdminOrder: vi.fn(),
}));
// Call vi.mock to perform this step.
vi.mock('../../api/locations', () => ({ getLocations: vi.fn() }));

// Declare a test suite grouping related cases.
describe('AdminOrderCreatePage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getNewOrderForm).mockResolvedValue({
      // Provide the cars field value.
      cars: [],
      // Provide the defaults field value.
      defaults: {
        // Provide the pickup date field value.
        pickupDate: '2026-07-10',
        // Provide the return date field value.
        returnDate: '2026-07-11',
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '10:00',
        // Provide the pickup location field value.
        pickupLocation: 'office',
        // Provide the return location field value.
        returnLocation: 'office',
      },
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getLocations).mockResolvedValue({
      // Provide the locations field value.
      locations: [{ id: 'office', label: 'Office' }],
    });
  });

  // Define a single test case and its expectations.
  it('renders create order form', async () => {
    renderWithRouter(<AdminOrderCreatePage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Create order' })).toBeInTheDocument();
    });
  });
});
