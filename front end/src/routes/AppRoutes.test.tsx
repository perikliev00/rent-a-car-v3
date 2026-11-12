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
vi.mock('../components/layout/PublicLayout', () => ({
  PublicLayout: () => <Outlet />,
}));

// Call vi.mock to perform this step.
vi.mock('../pages/public/HomePage', () => ({
  HomePage: () => <div>Home Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/public/SearchResultsPage', () => ({
  SearchResultsPage: () => <div>Search Results Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/public/CarDetailPage', () => ({
  CarDetailPage: () => <div>Car Detail Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/public/OrderPage', () => ({
  OrderPage: () => <div>Order Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/public/CheckoutPage', () => ({
  CheckoutPage: () => <div>Checkout Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/public/CheckoutSuccessPage', () => ({
  CheckoutSuccessPage: () => <div>Checkout Success Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/public/CheckoutCancelPage', () => ({
  CheckoutCancelPage: () => <div>Checkout Cancel Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/auth/LoginPage', () => ({
  LoginPage: () => <div>Login Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/auth/SignupPage', () => ({
  SignupPage: () => <div>Signup Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/auth/VerifyEmailPage', () => ({
  VerifyEmailPage: () => <div>Verify Email Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/account/AccountDashboardPage', () => ({
  AccountDashboardPage: () => <div>Account Dashboard Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/account/AccountReservationsPage', () => ({
  AccountReservationsPage: () => <div>Account Reservations Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/account/AccountReservationDetailPage', () => ({
  AccountReservationDetailPage: () => <div>Account Reservation Detail Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/account/AccountDocumentsPage', () => ({
  AccountDocumentsPage: () => <div>Account Documents Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/static/StaticPages', () => ({
  AboutPage: () => <div>About Page</div>,
  FaqPage: () => <div>FAQ Page</div>,
  TermsPage: () => <div>Terms Page</div>,
  PrivacyPage: () => <div>Privacy Page</div>,
  HowToBookPage: () => <div>How To Book Page</div>,
  SupportPage: () => <div>Support Page</div>,
  ContactPage: () => <div>Contact Page</div>,
}));
// Call vi.mock to perform this step.
vi.mock('../pages/NotFoundPage', () => ({
  NotFoundPage: () => <div>Not Found Page</div>,
}));

// Create the mocked use auth constant.
const mockedUseAuth = vi.mocked(useAuth);

// Define the mockGuestAuth function.
function mockGuestAuth() {
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
}

// Define the mockCustomerAuth function.
function mockCustomerAuth() {
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
}

// Declare a test suite grouping related cases.
describe('AppRoutes', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Update initialPath with the right-hand side value.
    initialPath = '/';
    // Call mockGuestAuth to perform this step.
    mockGuestAuth();
  });

  // Call it.each to perform this step.
  it.each([
    // Contribute this line to the enclosing declaration or statement.
    ['/', 'Home Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/search', 'Search Results Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/cars/1', 'Car Detail Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/order/1', 'Order Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/checkout/1', 'Checkout Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/checkout/success', 'Checkout Success Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/checkout/cancel', 'Checkout Cancel Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/login', 'Login Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/signup', 'Signup Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/verify-email', 'Verify Email Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/account', 'Account Dashboard Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/account/reservations', 'Account Reservations Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/account/documents', 'Account Documents Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/about', 'About Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/faq', 'FAQ Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/missing-route', 'Not Found Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin', 'Not Found Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/calendar', 'Not Found Page'],
    // Contribute this line to the enclosing declaration or statement.
    ['/admin/orders', 'Not Found Page'],
  // Continue the surrounding logic with this statement.
  ])('renders %s', (path, label) => {
    // Update initialPath with the right-hand side value.
    initialPath = path;
    // Evaluate the condition and enter the branch when it is true.
    if (path.startsWith('/account')) {
      // Call mockCustomerAuth to perform this step.
      mockCustomerAuth();
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Call mockGuestAuth to perform this step.
      mockGuestAuth();
    }
    render(<AppRoutes />);
    // Assert that the value matches the intended expectation.
    expect(screen.getByText(label)).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('does not load admin UI at /admin for staff users', () => {
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

    // Update initialPath with the right-hand side value.
    initialPath = '/admin';
    render(<AppRoutes />);

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Not Found Page')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByText('Admin Dashboard Page')).not.toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByRole('heading', { name: 'Access Denied' })).not.toBeInTheDocument();
  });
});
