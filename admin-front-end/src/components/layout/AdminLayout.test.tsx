// Import named exports from '@testing-library/react'.
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
// Import named exports from 'react-router-dom'.
import { Route, Routes } from 'react-router-dom';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../api/admin/cars'.
import { getFleetAlerts } from '../../api/admin/cars';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminLayout'.
import { AdminLayout } from './AdminLayout';

// Call vi.mock to perform this step.
vi.mock('../../auth/useAuth', () => ({
  // Provide the use auth field value.
  useAuth: vi.fn(),
}));
// Call vi.mock to perform this step.
vi.mock('../../api/admin/cars', () => ({
  // Provide the get fleet alerts field value.
  getFleetAlerts: vi.fn(),
}));
// Call vi.mock to perform this step.
vi.mock('../../hooks/useAdminRealtime', () => ({
  // Provide the use admin realtime field value.
  useAdminRealtime: vi.fn(() => 'live'),
}));

// Create the mocked use auth constant.
const mockedUseAuth = vi.mocked(useAuth);

// Define the mockOwnerAuth function.
function mockOwnerAuth(logout = vi.fn()) {
  // Call mockedUseAuth.mockReturnValue to perform this step.
  mockedUseAuth.mockReturnValue({
    // Provide the user field value.
    user: {
      // Provide the id field value.
      id: '1',
      // Provide the email field value.
      email: 'admin@example.com',
      // Provide the role field value.
      role: 'admin',
      // Provide the roles field value.
      roles: ['owner'],
      // Provide the permissions field value.
      permissions: [
        // Supply the literal value used by the enclosing expression.
        'can_view_orders',
        // Supply the literal value used by the enclosing expression.
        'can_manage_cars',
        // Supply the literal value used by the enclosing expression.
        'can_manage_pricing',
        // Supply the literal value used by the enclosing expression.
        'can_manage_fleet_alerts',
        // Supply the literal value used by the enclosing expression.
        'can_manage_contacts',
        // Supply the literal value used by the enclosing expression.
        'can_manage_payments_monitor',
        // Supply the literal value used by the enclosing expression.
        'can_view_revenue',
        // Supply the literal value used by the enclosing expression.
        'can_view_audit_logs',
        // Supply the literal value used by the enclosing expression.
        'can_view_reservations_ops',
        // Supply the literal value used by the enclosing expression.
        'can_manage_users',
        // Supply the literal value used by the enclosing expression.
        'can_view_calendar',
      ],
    },
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
}

// Define the renderAdminLayout function.
function renderAdminLayout(route = '/admin') {
  // Return the resulting value to the caller.
  return renderWithRouter(
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<div>Admin page content</div>} />
        <Route path="cars" element={<div>Cars page content</div>} />
      </Route>
    </Routes>,
    // Contribute this line to the enclosing declaration or statement.
    { route },
  );
}

// Declare a test suite grouping related cases.
describe('AdminLayout', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getFleetAlerts).mockResolvedValue({
      // Provide the summary field value.
      summary: { total: 2, critical: 1, warning: 1, info: 0 },
      // Provide the alerts field value.
      alerts: [],
    });
  });

  // Define a single test case and its expectations.
  it('renders admin nav and outlet', async () => {
    // Call mockOwnerAuth to perform this step.
    mockOwnerAuth();
    // Call renderAdminLayout to perform this step.
    renderAdminLayout();

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Admin page content')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThan(0);
    // Assert that the value matches the intended expectation.
    expect(screen.getAllByRole('link', { name: 'Audit logs' }).length).toBeGreaterThan(0);
    // Assert that the value matches the intended expectation.
    expect(screen.getByTestId('admin-mobile-menu')).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect((await screen.findAllByText(/Fleet alerts/)).length).toBeGreaterThan(0);
    // Assert that the value matches the intended expectation.
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0);
  });

  // Define a single test case and its expectations.
  it('opens the mobile drawer and closes it from the Close control', async () => {
    // Call mockOwnerAuth to perform this step.
    mockOwnerAuth();
    // Call renderAdminLayout to perform this step.
    renderAdminLayout();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByTestId('admin-mobile-menu'));
    // Create the drawer constant.
    const drawer = await screen.findByRole('dialog', { name: 'Admin menu' });
    // Assert that the value matches the intended expectation.
    expect(within(drawer).getByRole('navigation', { name: 'Admin' })).toBeInTheDocument();

    // Call fireEvent.click to perform this step.
    fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.queryByRole('dialog', { name: 'Admin menu' })).not.toBeInTheDocument();
    });
  });

  // Define a single test case and its expectations.
  it('closes the mobile drawer after navigating to another admin page', async () => {
    // Call mockOwnerAuth to perform this step.
    mockOwnerAuth();
    // Call renderAdminLayout to perform this step.
    renderAdminLayout();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByTestId('admin-mobile-menu'));
    // Create the drawer constant.
    const drawer = await screen.findByRole('dialog', { name: 'Admin menu' });

    // Call fireEvent.click to perform this step.
    fireEvent.click(within(drawer).getByRole('link', { name: 'Cars' }));

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.queryByRole('dialog', { name: 'Admin menu' })).not.toBeInTheDocument();
    });
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Cars page content')).toBeInTheDocument();
  });

  // Define a single test case and its expectations.
  it('logs out from the mobile drawer and closes it', async () => {
    // Create the logout constant.
    const logout = vi.fn();
    // Call mockOwnerAuth to perform this step.
    mockOwnerAuth(logout);
    // Call renderAdminLayout to perform this step.
    renderAdminLayout();

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByTestId('admin-mobile-menu'));
    // Wait until the asynchronous operation resolves.
    await screen.findByRole('dialog', { name: 'Admin menu' });

    // Call fireEvent.click to perform this step.
    fireEvent.click(screen.getByTestId('admin-mobile-logout'));

    // Assert that the value matches the intended expectation.
    expect(logout).toHaveBeenCalled();
    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.queryByRole('dialog', { name: 'Admin menu' })).not.toBeInTheDocument();
    });
  });
});
