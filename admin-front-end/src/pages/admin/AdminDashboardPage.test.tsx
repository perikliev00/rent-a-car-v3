// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/orders'.
import { getDashboard } from '../../api/admin/orders';
// Import named exports from '../../api/admin/cars'.
import { getFleetAlerts } from '../../api/admin/cars';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminDashboardPage'.
import { AdminDashboardPage } from './AdminDashboardPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/orders', () => ({ getDashboard: vi.fn() }));
// Call vi.mock to perform this step.
vi.mock('../../api/admin/cars', () => ({ getFleetAlerts: vi.fn() }));

// Declare a test suite grouping related cases.
describe('AdminDashboardPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getDashboard).mockResolvedValue({
      // Provide the orders field value.
      orders: [],
      // Provide the stats field value.
      stats: { totalOrders: 0, totalRevenue: '0', pendingOrders: 0 },
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getFleetAlerts).mockResolvedValue({
      // Provide the summary field value.
      summary: { total: 1, critical: 1, warning: 0, info: 0 },
      // Provide the alerts field value.
      alerts: [
        {
          // Provide the id field value.
          id: 'insurance_expired:1',
          // Provide the type field value.
          type: 'insurance_expired',
          // Provide the severity field value.
          severity: 'critical',
          // Provide the car id field value.
          carId: '1',
          // Provide the car name field value.
          carName: 'Yaris',
          // Provide the message field value.
          message: 'Insurance expired on 2026-01-01',
        },
      ],
    });
  });

  // Define a single test case and its expectations.
  it('renders dashboard heading', async () => {
    renderWithRouter(<AdminDashboardPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Total orders')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(await screen.findByText('Insurance expired on 2026-01-01')).toBeInTheDocument();
  });
});
