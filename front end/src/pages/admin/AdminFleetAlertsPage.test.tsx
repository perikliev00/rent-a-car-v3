import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getFleetAlerts } from '../../api/admin/cars';
import { renderWithRouter } from '../../test/test-utils';
import { AdminFleetAlertsPage } from './AdminFleetAlertsPage';

vi.mock('../../api/admin/cars', () => ({
  getFleetAlerts: vi.fn(),
}));

describe('AdminFleetAlertsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders empty state', async () => {
    vi.mocked(getFleetAlerts).mockResolvedValue({
      summary: { total: 0, critical: 0, warning: 0, info: 0 },
      alerts: [],
    });

    renderWithRouter(<AdminFleetAlertsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Fleet alerts' })).toBeInTheDocument();
    });
    expect(screen.getByText('No fleet issues')).toBeInTheDocument();
  });

  it('renders alerts list', async () => {
    vi.mocked(getFleetAlerts).mockResolvedValue({
      summary: { total: 1, critical: 1, warning: 0, info: 0 },
      alerts: [
        {
          id: 'persisted:1',
          type: 'insurance_expired',
          severity: 'critical',
          carId: '3',
          carName: 'BMW 320',
          message: 'Civil insurance expired on 2026-01-01',
        },
      ],
    });

    renderWithRouter(<AdminFleetAlertsPage />);

    await waitFor(() => {
      expect(screen.getByText('Civil insurance expired on 2026-01-01')).toBeInTheDocument();
    });
    expect(screen.getByText('BMW 320')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open car' })).toHaveAttribute(
      'href',
      '/admin/cars/3'
    );
  });
});
