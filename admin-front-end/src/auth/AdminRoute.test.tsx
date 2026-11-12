import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AdminRoute } from './AdminRoute';
import { useAuth } from './useAuth';
import { renderWithRouter } from '../test/test-utils';

vi.mock('./useAuth', () => ({
  useAuth: vi.fn(),
}));

const mockedUseAuth = vi.mocked(useAuth);

describe('AdminRoute', () => {
  it('shows loading spinner while auth is loading', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoading: true,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    const { container } = renderWithRouter(
      <AdminRoute>
        <div>Admin content</div>
      </AdminRoute>,
      { route: '/admin' },
    );

    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
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

    renderWithRouter(
      <AdminRoute>
        <div>Admin content</div>
      </AdminRoute>,
      { route: '/admin' },
    );

    expect(screen.getByText('Login page')).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  it('denies access to non-admin users', async () => {
    const logout = vi.fn();
    mockedUseAuth.mockReturnValue({
      user: { id: '1', email: 'user@example.com', role: 'user' },
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout,
      refresh: vi.fn(),
    });

    renderWithRouter(
      <AdminRoute>
        <div>Admin content</div>
      </AdminRoute>,
      { route: '/admin' },
    );

    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  it('renders children for admin users', () => {
    mockedUseAuth.mockReturnValue({
      user: { id: '2', email: 'admin@example.com', role: 'admin', roles: ['owner'] },
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithRouter(
      <AdminRoute>
        <div>Admin content</div>
      </AdminRoute>,
      { route: '/admin' },
    );

    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  it('renders children for staff users with roles', () => {
    mockedUseAuth.mockReturnValue({
      user: {
        id: '3',
        email: 'driver@example.com',
        role: 'staff',
        roles: ['driver'],
        permissions: ['can_view_reservations_ops'],
      },
      isLoading: false,
      login: vi.fn(),
      signup: vi.fn(),
      logout: vi.fn(),
      refresh: vi.fn(),
    });

    renderWithRouter(
      <AdminRoute>
        <div>Staff content</div>
      </AdminRoute>,
      { route: '/admin' },
    );

    expect(screen.getByText('Staff content')).toBeInTheDocument();
  });
});
