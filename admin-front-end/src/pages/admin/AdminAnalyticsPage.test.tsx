// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/analytics'.
import { getAnalyticsOverview } from '../../api/admin/analytics';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminAnalyticsPage'.
import { AdminAnalyticsPage } from './AdminAnalyticsPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/analytics', () => ({
  // Provide the get analytics overview field value.
  getAnalyticsOverview: vi.fn(),
  // Provide the get revenue by car field value.
  getRevenueByCar: vi.fn().mockResolvedValue({ rows: [] }),
  // Provide the get revenue by location field value.
  getRevenueByLocation: vi.fn().mockResolvedValue({ rows: [] }),
  // Provide the get utilization field value.
  getUtilization: vi.fn().mockResolvedValue({ periodDays: 30, rows: [] }),
  // Provide the get cars performance field value.
  getCarsPerformance: vi.fn().mockResolvedValue({ periodDays: 30, rows: [] }),
}));

// Call vi.mock to perform this step.
vi.mock('recharts', () => ({
  // Provide the responsive container field value.
  ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="chart">{children}</div>
  ),
  LineChart: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  // Provide the line field value.
  Line: () => null,
  // Provide the xaxis field value.
  XAxis: () => null,
  // Provide the yaxis field value.
  YAxis: () => null,
  // Provide the cartesian grid field value.
  CartesianGrid: () => null,
  // Provide the tooltip field value.
  Tooltip: () => null,
}));

// Call vi.mock to perform this step.
vi.mock('../../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: () => ({
    // Provide the user field value.
    user: {
      // Provide the id field value.
      id: '1',
      // Provide the role field value.
      role: 'admin',
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: ['can_view_revenue', 'can_export_reports'],
    },
  }),
}));

// Declare a test suite grouping related cases.
describe('AdminAnalyticsPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getAnalyticsOverview).mockResolvedValue({
      // Provide the from field value.
      from: '2026-07-01',
      // Provide the to field value.
      to: '2026-07-31',
      // Provide the period days field value.
      periodDays: 31,
      // Provide the kpis field value.
      kpis: {
        // Provide the monthly revenue field value.
        monthlyRevenue: 1200,
        // Provide the weekly bookings field value.
        weeklyBookings: 4,
        // Provide the occupancy rate field value.
        occupancyRate: 0.42,
        // Provide the average daily rate field value.
        averageDailyRate: 80,
        // Provide the cancelled bookings field value.
        cancelledBookings: 1,
        // Provide the failed payments field value.
        failedPayments: { total: 2, unresolved: 1 },
        // Provide the conversion rate field value.
        conversionRate: 0.5,
        // Provide the checkout starts field value.
        checkoutStarts: 8,
        // Provide the successful bookings field value.
        successfulBookings: 4,
        // Provide the abandoned holds field value.
        abandonedHolds: 2,
        // Provide the order count field value.
        orderCount: 4,
        // Provide the rented days field value.
        rentedDays: 10,
        // Provide the available days field value.
        availableDays: 24,
        // Provide the active cars field value.
        activeCars: 3,
      },
      // Provide the revenue series field value.
      revenueSeries: [{ day: '2026-07-01', revenue: 100, orders: 1 }],
      // Provide the bookings series field value.
      bookingsSeries: [{ day: '2026-07-01', bookings: 1 }],
      // Provide the most rented cars field value.
      mostRentedCars: [],
    });
  });

  // Define a single test case and its expectations.
  it('renders analytics heading and KPIs', async () => {
    renderWithRouter(<AdminAnalyticsPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Confirmed bookings')).toBeInTheDocument();
  });
});
