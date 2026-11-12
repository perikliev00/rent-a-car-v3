// Import named exports from '@testing-library/react'.
import { render, screen } from '@testing-library/react';
// Import named exports from 'react-router-dom'.
import { Outlet } from 'react-router-dom';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from './AppRoutes'.
import { AppRoutes } from './AppRoutes';
// Import named exports from '../auth/useAuth'.
import { useAuth } from '../auth/useAuth';

// Initialize the mutable initial path variable.
let initialPath = '/';

// Call vi.mock to perform this step.
vi.mock('react-router-dom', async () => {
  // Create the actual constant.
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  // Return the resulting value to the caller.
  return {
    // Spread actual into the surrounding structure.
    ...actual,
    // Provide the browser router field value.
    BrowserRouter: ({ children }: { children: React.ReactNode }) => (
      <actual.MemoryRouter initialEntries={[initialPath]}>{children}</actual.MemoryRouter>
    ),
  };
});

// Call vi.mock to perform this step.
vi.mock('../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: vi.fn(),
}));

// Call vi.mock to perform this step.
vi.mock('../components/layout/AdminLayout', () => ({
  AdminLayout: () => <Outlet />,
}));

// Call vi.mock to perform this step.
vi.mock('../pages/auth/LoginPage', () => ({
  LoginPage: () => <div>Login Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminDashboardPage', () => ({
  AdminDashboardPage: () => <div>Admin Dashboard Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminCarsPage', () => ({
  AdminCarsPage: () => <div>Admin Cars Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminCarDetailPage', () => ({
  AdminCarDetailPage: () => <div>Admin Car Detail Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminFleetAlertsPage', () => ({
  AdminFleetAlertsPage: () => <div>Admin Fleet Alerts Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminOrdersPage', () => ({
  AdminOrdersPage: () => <div>Admin Orders Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminOrderCreatePage', () => ({
  AdminOrderCreatePage: () => <div>Admin Order Create Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminOrderDetailPage', () => ({
  AdminOrderDetailPage: () => <div>Admin Order Detail Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminOrderEditPage', () => ({
  AdminOrderEditPage: () => <div>Admin Order Edit Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminContactsPage', () => ({
  AdminContactsPage: () => <div>Admin Contacts Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminPaymentsPage', () => ({
  AdminPaymentsPage: () => <div>Admin Payments Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminAuditLogsPage', () => ({
  AdminAuditLogsPage: () => <div>Admin Audit Logs Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminReservationOpsPage', () => ({
  AdminReservationOpsPage: () => <div>Admin Reservation Ops Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminCalendarPage', () => ({
  AdminCalendarPage: () => <div>Admin Calendar Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/tasks/ManagerTasksPage', () => ({
  ManagerTasksPage: () => <div>Manager Tasks Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/tasks/RoleTasksPages', () => ({
  DriverTasksPage: () => <div>Driver Tasks Page</div>,
  CleanerTasksPage: () => <div>Cleaner Tasks Page</div>,
  ReceptionistTasksPage: () => <div>Receptionist Tasks Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminAnalyticsPage', () => ({
  AdminAnalyticsPage: () => <div>Admin Analytics Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminNotificationsPage', () => ({
  AdminNotificationsPage: () => <div>Admin Notifications Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminPricingSettingsPage', () => ({
  AdminPricingSettingsPage: () => <div>Admin Pricing Settings Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminUsersPage', () => ({
  AdminUsersPage: () => <div>Admin Users Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/admin/AdminRolesPage', () => ({
  AdminRolesPage: () => <div>Admin Roles Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/NotFoundPage', () => ({
  NotFoundPage: () => <div>Not Found Page</div>,
}));

// Create the mocked use auth constant.
const mockedUseAuth = vi.mocked(useAuth);

// Define the mockAdminAuth function.
function mockAdminAuth() {
  // Call mockedUseAuth.mockReturnValue to perform this step.
  mockedUseAuth.mockReturnValue({
    // Provide the user field value.
    user: {
      // Provide the id field value.
      id: '2',
      // Provide the email field value.
      email: 'admin@example.com',
      // Provide the role field value.
      role: 'admin',
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: [],
    },
    // Provide the is loading field value.
    isLoading: false,
    // Provide the login field value.
    login: vi.fn(),
    // Provide the signup field value.
    signup: vi.fn(),
    // Provide the logout field value.
    logout: vi.fn(),
    // Provide the refresh field value.
    refresh: vi.fn(),
  });
}

// Declare a test suite grouping related cases.
describe('AppRoutes', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Update initialPath with the right-hand side value.
    initialPath = '/';
    // Call mockAdminAuth to perform this step.
    mockAdminAuth();
  });

  // Call it.each to perform this step.
  it.each([
    // Contribute this line to the enclosing declaration or statement.
    ['/', 'Admin Dashboard Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/login', 'Login Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin', 'Admin Dashboard Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/reservations', 'Admin Reservation Ops Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/calendar', 'Admin Calendar Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/tasks', 'Manager Tasks Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/tasks/driver', 'Driver Tasks Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/tasks/cleaner', 'Cleaner Tasks Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/tasks/receptionist', 'Receptionist Tasks Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/cars', 'Admin Cars Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/orders', 'Admin Orders Page'],
    // Continue the surrounding logic with this statement.
    ['/admin/orders/new', 'Admin Order Create Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/orders/42', 'Admin Order Detail Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/orders/42/edit', 'Admin Order Edit Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/contacts', 'Admin Contacts Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/payments', 'Admin Payments Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/audit-logs', 'Admin Audit Logs Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/missing-route', 'Not Found Page'],
  // Continue the surrounding logic with this statement.
  ])('renders %s', (path, label) => {
    // Update initialPath with the right-hand side value.
    initialPath = path;
    render(<AppRoutes />);
    // Assert that the value matches the intended expectation.
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('blocks non-staff users from admin routes via AdminRoute', () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: { id: '1', email: 'user@example.com', role: 'user' },
      // Provide the is loading field value.
      isLoading: false,
      // Provide the login field value.
      login: vi.fn(),
      // Provide the signup field value.
      signup: vi.fn(),
      // Provide the logout field value.
      logout: vi.fn(),
      // Provide the refresh field value.
      refresh: vi.fn(),
    });

    // Update initialPath with the right-hand side value.
    initialPath = '/admin';
    render(<AppRoutes />);

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('redirects unauthenticated users from admin routes to login', () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: null,
      // Provide the is loading field value.
      isLoading: false,
      // Provide the login field value.
      login: vi.fn(),
      // Provide the signup field value.
      signup: vi.fn(),
      // Provide the logout field value.
      logout: vi.fn(),
      // Provide the refresh field value.
      refresh: vi.fn(),
    });

    // Update initialPath with the right-hand side value.
    initialPath = '/admin';
    render(<AppRoutes />);

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument();
  });
});
