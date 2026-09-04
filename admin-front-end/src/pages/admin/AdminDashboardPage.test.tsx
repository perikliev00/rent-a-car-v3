import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getDashboard } from '../../api/admin/orders';
import { getFleetAlerts } from '../../api/admin/cars';
import { renderWithRouter } from '../../test/test-utils';
import { AdminDashboardPage } from './AdminDashboardPage';

vi.mock('../../api/admin/orders', () => ({ getDashboard: vi.fn() }));
vi.mock('../../api/admin/cars', () => ({ getFleetAlerts: vi.fn() }));

describe('AdminDashboardPage', () => {
  beforeEach(() => {
    vi.mocked(getDashboard).mockResolvedValue({
      orders: [],
      stats: { totalOrders: 0, totalRevenue: '0', pendingOrders: 0 },
    });
    vi.mocked(getFleetAlerts).mockResolvedValue({
      summary: { total: 1, critical: 1, warning: 0, info: 0 },
      alerts: [
        {
          id: 'insurance_expired:1',
          type: 'insurance_expired',
          severity: 'critical',
          carId: '1',
          carName: 'Yaris',
          message: 'Insurance expired on 2026-01-01',
        },
      ],
    });
  });

  it('renders dashboard heading', async () => {
    renderWithRouter(<AdminDashboardPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    });

    expect(screen.getByText('Total orders')).toBeInTheDocument();
    expect(await screen.findByText('Insurance expired on 2026-01-01')).toBeInTheDocument();
  });
});
