import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from './useAuth';
import type { AuthContextValue } from './auth-context';

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

function mockAuth(
  user: AuthContextValue['user'],
  { isLoading = false, emailVerified = true } = {},
) {
  mockedUseAuth.mockReturnValue({
    user,
    isLoading,
    emailVerified: Boolean(user) && emailVerified,
    verificationRequired: Boolean(user) && !emailVerified,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    refresh: vi.fn(),
  });
}

function LoginCatcher() {
  const location = useLocation();
  const from = (location.state as { from?: { pathname: string } })?.from;
  return (
    <div>
      Login page
      <span data-testid="from-path">{from?.pathname ?? ''}</span>
    </div>
  );
}

function renderProtectedRoute(
  route: string,
  children: ReactNode = <div>Protected content</div>,
  { requireVerifiedEmail = false } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/login" element={<LoginCatcher />} />
          <Route path="/account/verify-email" element={<div>Verify email page</div>} />
          <Route
            path="/checkout/:carId"
            element={
              <ProtectedRoute requireVerifiedEmail={requireVerifiedEmail}>
                {children}
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    mockAuth(null, { isLoading: true });

    const { container } = renderProtectedRoute('/checkout/1');

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', () => {
    mockAuth(null);

    renderProtectedRoute('/checkout/1');

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirect passes state.from with current location', () => {
    mockAuth(null);

    renderProtectedRoute('/checkout/1');

    expect(screen.getByTestId('from-path')).toHaveTextContent('/checkout/1');
  });

  it('renders children for authenticated users', () => {
    mockAuth({ id: '1', email: 'user@example.com', role: 'user' });

    renderProtectedRoute('/checkout/1');

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('does not gate on verification unless the route asks for it', () => {
    mockAuth({ id: '1', email: 'user@example.com', role: 'user' }, { emailVerified: false });

    renderProtectedRoute('/checkout/1');

    // Guest checkout must keep working for an unverified account.
    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });

  it('redirects unverified users away from verification-gated routes', () => {
    mockAuth({ id: '1', email: 'user@example.com', role: 'user' }, { emailVerified: false });

    renderProtectedRoute('/checkout/1', <div>Protected content</div>, {
      requireVerifiedEmail: true,
    });

    expect(screen.getByText('Verify email page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });
});
