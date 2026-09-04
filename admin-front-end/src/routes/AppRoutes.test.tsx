import { render, screen } from '@testing-library/react';
import { Outlet } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './AppRoutes';
import { useAuth } from '../auth/useAuth';

let initialPath = '/';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <actual.MemoryRouter initialEntries={[initialPath]}>{children}</actual.MemoryRouter>
    ),
  };
});

vi.mock('../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../components/layout/AdminLayout', () => ({
  AdminLayout: () => <Outlet />,
}));

vi.mock('../pages/auth/LoginPage', () => ({
  LoginPage: () => <div>Login Page</div>,
}));
vi.mock('../pages/admin/AdminDashboardPage', () => ({
  AdminDashboardPage: () => <div>Admin Dashboard Page</div>,
}));
vi.mock('../pages/admin/AdminCarsPage', () => ({
  AdminCarsPage: () => <div>Admin Cars Page</div>,
}));
vi.mock('../pages/admin/AdminCarDetailPage', () => ({
  AdminCarDetailPage: () => <div>Admin Car Detail Page</div>,
}));
vi.mock('../pages/admin/AdminFleetAlertsPage', () => ({
  AdminFleetAlertsPage: () => <div>Admin Fleet Alerts Page</div>,
}));
vi.mock('../pages/admin/AdminOrdersPage', () => ({
  AdminOrdersPage: () => <div>Admin Orders Page</div>,
}));
vi.mock('../pages/admin/AdminOrderCreatePage', () => ({
  AdminOrderCreatePage: () => <div>Admin Order Create Page</div>,
}));
vi.mock('../pages/admin/AdminOrderDetailPage', () => ({
  AdminOrderDetailPage: () => <div>Admin Order Detail Page</div>,
}));
vi.mock('../pages/admin/AdminOrderEditPage', () => ({
  AdminOrderEditPage: () => <div>Admin Order Edit Page</div>,
}));
vi.mock('../pages/admin/AdminContactsPage', () => ({
  AdminContactsPage: () => <div>Admin Contacts Page</div>,
}));
vi.mock('../pages/admin/AdminPaymentsPage', () => ({
  AdminPaymentsPage: () => <div>Admin Payments Page</div>,
}));
vi.mock('../pages/admin/AdminAuditLogsPage', () => ({
  AdminAuditLogsPage: () => <div>Admin Audit Logs Page</div>,
}));
vi.mock('../pages/admin/AdminReservationOpsPage', () => ({
  AdminReservationOpsPage: () => <div>Admin Reservation Ops Page</div>,
}));
vi.mock('../pages/admin/AdminCalendarPage', () => ({
  AdminCalendarPage: () => <div>Admin Calendar Page</div>,
}));
vi.mock('../pages/admin/tasks/ManagerTasksPage', () => ({
  ManagerTasksPage: () => <div>Manager Tasks Page</div>,
}));
vi.mock('../pages/admin/tasks/RoleTasksPages', () => ({
  DriverTasksPage: () => <div>Driver Tasks Page</div>,
  CleanerTasksPage: () => <div>Cleaner Tasks Page</div>,
  ReceptionistTasksPage: () => <div>Receptionist Tasks Page</div>,
}));
vi.mock('../pages/admin/AdminAnalyticsPage', () => ({
  AdminAnalyticsPage: () => <div>Admin Analytics Page</div>,
}));
vi.mock('../pages/admin/AdminNotificationsPage', () => ({
  AdminNotificationsPage: () => <div>Admin Notifications Page</div>,
}));
vi.mock('../pages/admin/AdminPricingSettingsPage', () => ({
  AdminPricingSettingsPage: () => <div>Admin Pricing Settings Page</div>,
}));
vi.mock('../pages/admin/AdminUsersPage', () => ({
  AdminUsersPage: () => <div>Admin Users Page</div>,
}));
vi.mock('../pages/admin/AdminRolesPage', () => ({
  AdminRolesPage: () => <div>Admin Roles Page</div>,
}));
vi.mock('../pages/NotFoundPage', () => ({
  NotFoundPage: () => <div>Not Found Page</div>,
}));

const mockedUseAuth = vi.mocked(useAuth);

function mockAdminAuth() {
  mockedUseAuth.mockReturnValue({
    user: {
      id: '2',
      email: 'admin@example.com',
      role: 'admin',
      roles: ['owner'],
      permissions: [],
    },
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

describe('AppRoutes', () => {
  beforeEach(() => {
    initialPath = '/';
    mockAdminAuth();
  });

  it.each([
    ['/', 'Admin Dashboard Page'],
    ['/login', 'Login Page'],
    ['/admin', 'Admin Dashboard Page'],
    ['/admin/reservations', 'Admin Reservation Ops Page'],
    ['/admin/calendar', 'Admin Calendar Page'],
    ['/admin/tasks', 'Manager Tasks Page'],
    ['/admin/tasks/driver', 'Driver Tasks Page'],
    ['/admin/tasks/cleaner', 'Cleaner Tasks Page'],
    ['/admin/tasks/receptionist', 'Receptionist Tasks Page'],
    ['/admin/cars', 'Admin Cars Page'],
    ['/admin/orders', 'Admin Orders Page'],
    ['/admin/orders/new', 'Admin Order Create Page'],
    ['/admin/orders/42', 'Admin Order Detail Page'],
    ['/admin/orders/42/edit', 'Admin Order Edit Page'],
    ['/admin/contacts', 'Admin Contacts Page'],
    ['/admin/payments', 'Admin Payments Page'],
    ['/admin/audit-logs', 'Admin Audit Logs Page'],
    ['/missing-route', 'Not Found Page'],
  ])('renders %s', (path, label) => {
    initialPath = path;
    render(<AppRoutes />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('blocks non-staff users from admin routes via AdminRoute', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'user@example.com', role: 'user' },
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    initialPath = '/admin';
    render(<AppRoutes />);

    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users from admin routes to login', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    initialPath = '/admin';
    render(<AppRoutes />);

    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument();
  });
});
