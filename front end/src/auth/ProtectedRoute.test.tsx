// Import named exports from '@testing-library/react'.
import { screen } from '@testing-library/react';
// Contribute this line to the enclosing declaration or statement.
import type { ReactNode } from 'react';
// Import named exports from 'react-router-dom'.
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
// Import named exports from '@testing-library/react'.
import { render } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from './ProtectedRoute'.
import { ProtectedRoute } from './ProtectedRoute';
// Import named exports from './useAuth'.
import { useAuth } from './useAuth';

// Call vi.mock to perform this step.
vi.mock('./useAuth', () => ({
  // Provide the use auth field value.
  useAuth: vi.fn(),
}));

// Create the mocked use auth constant.
const mockedUseAuth = vi.mocked(useAuth);

// Define the LoginCatcher function.
function LoginCatcher() {
  // Create the location constant.
  const location = useLocation();
  // Create the from constant.
  const from = (location.state as { from?: { pathname: string } })?.from;
  // Return control to the caller with the following value.
  return (
    <div>
      Login page
      <span data-testid="from-path">{from?.pathname ?? ''}</span>
    </div>
  );
}

function renderProtectedRoute(route: string, children: ReactNode = <div>Protected content</div>) {
  // Create the query client constant.
  const queryClient = new QueryClient({
    // Provide the default options field value.
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  // Return the resulting value to the caller.
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/login" element={<LoginCatcher />} />
          <Route
            path="/checkout/:carId"
            element={<ProtectedRoute>{children}</ProtectedRoute>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Declare a test suite grouping related cases.
describe('ProtectedRoute', () => {
  // Define a single test case and its expectations.
  it('shows loading spinner while auth is loading', () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: null,
      // Provide the is loading field value.
      isLoading: true,
      // Provide the login field value.
      login: vi.fn(),
      // Provide the signup field value.
      signup: vi.fn(),
      // Provide the logout field value.
      logout: vi.fn(),
      // Provide the refresh field value.
      refresh: vi.fn(),
    });

    // Destructure object properties into local variables.
    const { container } = renderProtectedRoute('/checkout/1');

    // Assert that the value matches the intended expectation.
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('redirects unauthenticated users to login', () => {
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

    // Call renderProtectedRoute to perform this step.
    renderProtectedRoute('/checkout/1');

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Login page')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('redirect passes state.from with current location', () => {
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

    // Call renderProtectedRoute to perform this step.
    renderProtectedRoute('/checkout/1');

    // Assert that the value matches the intended expectation.
    expect(screen.getByTestId('from-path')).toHaveTextContent('/checkout/1');
  });

  // Define a single test case and its expectations.
  it('renders children for authenticated users', () => {
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

    // Call renderProtectedRoute to perform this step.
    renderProtectedRoute('/checkout/1');

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
