import { screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuth } from './useAuth';

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

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

function renderProtectedRoute(route: string, children: ReactNode = <div>Protected content</div>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

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

describe('ProtectedRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    const { container } = renderProtectedRoute('/checkout/1');

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirects unauthenticated users to login', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderProtectedRoute('/checkout/1');

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Protected content')).not.toBeInTheDocument();
  });

  it('redirect passes state.from with current location', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderProtectedRoute('/checkout/1');

    expect(screen.getByTestId('from-path')).toHaveTextContent('/checkout/1');
  });

  it('renders children for authenticated users', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'user@example.com', role: 'user' },
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderProtectedRoute('/checkout/1');

    expect(screen.getByText('Protected content')).toBeInTheDocument();
  });
});
