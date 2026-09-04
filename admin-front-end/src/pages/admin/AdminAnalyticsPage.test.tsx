import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAnalyticsOverview } from '../../api/admin/analytics';
import { renderWithRouter } from '../../test/test-utils';
import { AdminAnalyticsPage } from './AdminAnalyticsPage';

vi.mock('../../api/admin/analytics', () => ({
  getAnalyticsOverview: vi.fn(),
  getRevenueByCar: vi.fn().mockResolvedValue({ rows: [] }),
  getRevenueByLocation: vi.fn().mockResolvedValue({ rows: [] }),
  getUtilization: vi.fn().mockResolvedValue({ periodDays: 30, rows: [] }),
  getCarsPerformance: vi.fn().mockResolvedValue({ periodDays: 30, rows: [] }),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="chart">{children}</div>
  ),
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
}));

vi.mock('../../auth/useAuth', () => ({
  useAuth: () => ({
    user: {
      id: '1',
      role: 'admin',
      roles: ['owner'],
      permissions: ['can_view_revenue', 'can_export_reports'],
    },
  }),
}));

describe('AdminAnalyticsPage', () => {
  beforeEach(() => {
    vi.mocked(getAnalyticsOverview).mockResolvedValue({
      from: '2026-07-01',
      to: '2026-07-31',
      periodDays: 31,
      kpis: {
        monthlyRevenue: 1200,
        weeklyBookings: 4,
        occupancyRate: 0.42,
        averageDailyRate: 80,
        cancelledBookings: 1,
        failedPayments: { total: 2, unresolved: 1 },
        conversionRate: 0.5,
        checkoutStarts: 8,
        successfulBookings: 4,
        abandonedHolds: 2,
        orderCount: 4,
        rentedDays: 10,
        availableDays: 24,
        activeCars: 3,
      },
      revenueSeries: [{ day: '2026-07-01', revenue: 100, orders: 1 }],
      bookingsSeries: [{ day: '2026-07-01', bookings: 1 }],
      mostRentedCars: [],
    });
  });

  it('renders analytics heading and KPIs', async () => {
    renderWithRouter(<AdminAnalyticsPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    });

    expect(screen.getByText('Confirmed bookings')).toBeInTheDocument();
  });
});
