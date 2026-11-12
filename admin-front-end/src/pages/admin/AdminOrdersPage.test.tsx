// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getAdminOrders,
  // Contribute this line to the enclosing declaration or statement.
  getDeletedOrders,
  // Contribute this line to the enclosing declaration or statement.
  getExpiredOrders,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/admin/orders';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminOrdersPage'.
import { AdminOrdersPage } from './AdminOrdersPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/orders', () => ({
  // Provide the get admin orders field value.
  getAdminOrders: vi.fn(),
  // Provide the get deleted orders field value.
  getDeletedOrders: vi.fn(),
  // Provide the get expired orders field value.
  getExpiredOrders: vi.fn(),
  // Provide the delete admin order field value.
  deleteAdminOrder: vi.fn(),
  // Provide the restore admin order field value.
  restoreAdminOrder: vi.fn(),
  // Provide the empty deleted orders field value.
  emptyDeletedOrders: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('AdminOrdersPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getAdminOrders).mockResolvedValue({
      // Provide the orders field value.
      orders: [],
      // Provide the filters field value.
      filters: { status: '', startDate: '', endDate: '', search: '' },
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getDeletedOrders).mockResolvedValue({ orders: [] });
    // Call vi.mocked to perform this step.
    vi.mocked(getExpiredOrders).mockResolvedValue({ orders: [] });
  });

  // Define a single test case and its expectations.
  it('renders orders management page', async () => {
    renderWithRouter(<AdminOrdersPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Orders' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('link', { name: 'Create order' })).toBeInTheDocument();
  });
});
