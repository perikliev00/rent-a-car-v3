// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/cars'.
import { getFleetAlerts } from '../../api/admin/cars';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminFleetAlertsPage'.
import { AdminFleetAlertsPage } from './AdminFleetAlertsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/cars', () => ({
  // Provide the get fleet alerts field value.
  getFleetAlerts: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('AdminFleetAlertsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.clearAllMocks to perform this step.
    vi.clearAllMocks();
  });

  // Define a single test case and its expectations.
  it('renders empty state', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getFleetAlerts).mockResolvedValue({
      // Provide the summary field value.
      summary: { total: 0, critical: 0, warning: 0, info: 0 },
      // Provide the alerts field value.
      alerts: [],
    });

    renderWithRouter(<AdminFleetAlertsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Fleet alerts' })).toBeInTheDocument();
    });
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('No fleet issues')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('renders alerts list', async () => {
    // Call vi.mocked to perform this step.
    vi.mocked(getFleetAlerts).mockResolvedValue({
      // Provide the summary field value.
      summary: { total: 1, critical: 1, warning: 0, info: 0 },
      // Provide the alerts field value.
      alerts: [
        {
          // Provide the id field value.
          id: 'persisted:1',
          // Provide the type field value.
          type: 'insurance_expired',
          // Provide the severity field value.
          severity: 'critical',
          // Provide the car id field value.
          carId: '3',
          // Provide the car name field value.
          carName: 'BMW 320',
          // Provide the message field value.
          message: 'Civil insurance expired on 2026-01-01',
        },
      ],
    });

    renderWithRouter(<AdminFleetAlertsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByText('Civil insurance expired on 2026-01-01')).toBeInTheDocument();
    });
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('BMW 320')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('link', { name: 'Open car' })).toHaveAttribute(
      // Supply the literal value used by the enclosing expression.
      'href',
      // Supply the literal value used by the enclosing expression.
      '/admin/cars/3'
    );
  });
});
