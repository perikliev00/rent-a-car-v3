// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { describe, expect, it, vi } from 'vitest';
// Import named exports from './AdminRoute'.
import { AdminRoute } from './AdminRoute';
// Import named exports from './useAuth'.
import { useAuth } from './useAuth';
// Import named exports from '../test/test-utils'.
import { renderWithRouter } from '../test/test-utils';

// Call vi.mock to perform this step.
vi.mock('./useAuth', () => ({
  // Provide the use auth field value.
  useAuth: vi.fn(),
}));

// Create the mocked use auth constant.
const mockedUseAuth = vi.mocked(useAuth);

// Declare a test suite grouping related cases.
describe('AdminRoute', () => {
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
    const { container } = renderWithRouter(
      <AdminRoute>
        <div>Admin content</div>
      </AdminRoute>,
      // Contribute this line to the enclosing declaration or statement.
      { route: '/admin' },
    );

    // Assert that the value matches the intended expectation.
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
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

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <AdminRoute>
        <div>Admin content</div>
      </AdminRoute>,
      // Contribute this line to the enclosing declaration or statement.
      { route: '/admin' },
    );

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Login page')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('denies access to non-admin users', async () => {
    // Create the logout constant.
    const logout = vi.fn();
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
      // Contribute this line to the enclosing declaration or statement.
      logout,
      // Provide the refresh field value.
      refresh: vi.fn(),
    });

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <AdminRoute>
        <div>Admin content</div>
      </AdminRoute>,
      // Contribute this line to the enclosing declaration or statement.
      { route: '/admin' },
    );

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('heading', { name: 'Access Denied' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument();
    // Wait until the asynchronous operation resolves.
    await waitFor(() => expect(logout).toHaveBeenCalled());
  });

  // Define a single test case and its expectations.
  it('renders children for admin users', () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: { id: '2', email: 'admin@example.com', role: 'admin', roles: ['owner'] },
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

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <AdminRoute>
        <div>Admin content</div>
      </AdminRoute>,
      // Contribute this line to the enclosing declaration or statement.
      { route: '/admin' },
    );

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Admin content')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('renders children for staff users with roles', () => {
    // Call mockedUseAuth.mockReturnValue to perform this step.
    mockedUseAuth.mockReturnValue({
      // Provide the user field value.
      user: {
        // Provide the id field value.
        id: '3',
        // Provide the email field value.
        email: 'driver@example.com',
        // Provide the role field value.
        role: 'staff',
        // Provide the roles field value.
        roles: ['driver'],
        // Provide the permissions field value.
        permissions: ['can_view_reservations_ops'],
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

    // Call renderWithRouter to perform this step.
    renderWithRouter(
      <AdminRoute>
        <div>Staff content</div>
      </AdminRoute>,
      // Contribute this line to the enclosing declaration or statement.
      { route: '/admin' },
    );

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Staff content')).toBeInTheDocument();
  });
});
