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
vi.mock('../pages/auth/VerifyEmailPage', () => ({
  VerifyEmailPage: () => <div>Verify Email Page</div>,
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

function mockGuestAuth() {
  mockedUseAuth.mockReturnValue({
    user: null,
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

function mockCustomerAuth() {
  mockedUseAuth.mockReturnValue({
    user: { id: '1', email: 'user@example.com', role: 'user' },
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
    mockGuestAuth();
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
    ['/verify-email', 'Verify Email Page'],
    ['/account', 'Account Dashboard Page'],
    ['/account/reservations', 'Account Reservations Page'],
    ['/account/documents', 'Account Documents Page'],
    ['/about', 'About Page'],
    ['/faq', 'FAQ Page'],
    ['/missing-route', 'Not Found Page'],
    ['/admin', 'Not Found Page'],
    ['/admin/calendar', 'Not Found Page'],
    ['/admin/orders', 'Not Found Page'],
  ])('renders %s', (path, label) => {
    initialPath = path;
    if (path.startsWith('/account')) {
      mockCustomerAuth();
    } else {
      mockGuestAuth();
    }
    render(<AppRoutes />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  it('does not load admin UI at /admin for staff users', () => {
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

    initialPath = '/admin';
    render(<AppRoutes />);

    expect(screen.getByText('Not Found Page')).toBeInTheDocument();
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Access Denied' })).not.toBeInTheDocument();
  });
});
