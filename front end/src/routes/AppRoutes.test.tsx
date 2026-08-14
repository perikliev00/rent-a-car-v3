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

vi.mock('../components/layout/PublicLayout', () => ({
  PublicLayout: () => <Outlet />,
}));

vi.mock('../components/layout/AdminLayout', () => ({
  AdminLayout: () => <Outlet />,
}));

vi.mock('../pages/public/HomePage', () => ({
  HomePage: () => <div>Home Page</div>,
}));
vi.mock('../pages/public/SearchResultsPage', () => ({
  SearchResultsPage: () => <div>Search Results Page</div>,
}));
vi.mock('../pages/public/CarDetailPage', () => ({
  CarDetailPage: () => <div>Car Detail Page</div>,
}));
vi.mock('../pages/public/OrderPage', () => ({
  OrderPage: () => <div>Order Page</div>,
}));
vi.mock('../pages/public/CheckoutPage', () => ({
  CheckoutPage: () => <div>Checkout Page</div>,
}));
vi.mock('../pages/public/CheckoutSuccessPage', () => ({
  CheckoutSuccessPage: () => <div>Checkout Success Page</div>,
}));
vi.mock('../pages/public/CheckoutCancelPage', () => ({
  CheckoutCancelPage: () => <div>Checkout Cancel Page</div>,
}));
vi.mock('../pages/auth/LoginPage', () => ({
  LoginPage: () => <div>Login Page</div>,
}));
vi.mock('../pages/auth/SignupPage', () => ({
  SignupPage: () => <div>Signup Page</div>,
}));
vi.mock('../pages/account/AccountDashboardPage', () => ({
  AccountDashboardPage: () => <div>Account Dashboard Page</div>,
}));
vi.mock('../pages/account/AccountReservationsPage', () => ({
  AccountReservationsPage: () => <div>Account Reservations Page</div>,
}));
vi.mock('../pages/account/AccountReservationDetailPage', () => ({
  AccountReservationDetailPage: () => <div>Account Reservation Detail Page</div>,
}));
vi.mock('../pages/account/AccountDocumentsPage', () => ({
  AccountDocumentsPage: () => <div>Account Documents Page</div>,
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
vi.mock('../pages/static/StaticPages', () => ({
  AboutPage: () => <div>About Page</div>,
  FaqPage: () => <div>FAQ Page</div>,
  TermsPage: () => <div>Terms Page</div>,
  PrivacyPage: () => <div>Privacy Page</div>,
  HowToBookPage: () => <div>How To Book Page</div>,
  SupportPage: () => <div>Support Page</div>,
  ContactPage: () => <div>Contact Page</div>,
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
    ['/', 'Home Page'],
    ['/search', 'Search Results Page'],
    ['/cars/1', 'Car Detail Page'],
    ['/order/1', 'Order Page'],
    ['/checkout/1', 'Checkout Page'],
    ['/checkout/success', 'Checkout Success Page'],
    ['/checkout/cancel', 'Checkout Cancel Page'],
    ['/login', 'Login Page'],
    ['/signup', 'Signup Page'],
    ['/account', 'Account Dashboard Page'],
    ['/account/reservations', 'Account Reservations Page'],
    ['/account/documents', 'Account Documents Page'],
    ['/about', 'About Page'],
    ['/faq', 'FAQ Page'],
    ['/missing-route', 'Not Found Page'],
    ['/admin', 'Admin Dashboard Page'],
    ['/admin/reservations', 'Admin Reservation Ops Page'],
    ['/admin/cars', 'Admin Cars Page'],
    ['/admin/orders', 'Admin Orders Page'],
    ['/admin/orders/new', 'Admin Order Create Page'],
    ['/admin/orders/42', 'Admin Order Detail Page'],
    ['/admin/orders/42/edit', 'Admin Order Edit Page'],
    ['/admin/contacts', 'Admin Contacts Page'],
    ['/admin/payments', 'Admin Payments Page'],
    ['/admin/audit-logs', 'Admin Audit Logs Page'],
  ])('renders %s', (path, label) => {
    initialPath = path;
    if (path.startsWith('/account')) {
      mockedUseAuth.mockReturnValue({
        user: { id: '1', email: 'user@example.com', role: 'user' },
        isLoading: false,
        login: vi.fn(),
        signup: vi.fn(),
        logout: vi.fn(),
        refresh: vi.fn(),
      });
    } else {
      mockAdminAuth();
    }
    render(<AppRoutes />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('blocks non-admin users from admin routes via AdminRoute', () => {
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
