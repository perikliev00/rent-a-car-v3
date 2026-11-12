import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuth } from '../../auth/useAuth';
import { getFleetAlerts } from '../../api/admin/cars';
import { renderWithRouter } from '../../test/test-utils';
import { AdminLayout } from './AdminLayout';

vi.mock('../../auth/useAuth', () => ({
  useAuth: vi.fn(),
}));
vi.mock('../../api/admin/cars', () => ({
  getFleetAlerts: vi.fn(),
}));
vi.mock('../../hooks/useAdminRealtime', () => ({
  useAdminRealtime: vi.fn(() => 'live'),
}));

const mockedUseAuth = vi.mocked(useAuth);

function mockOwnerAuth(logout = vi.fn()) {
  mockedUseAuth.mockReturnValue({
    user: {
      id: '1',
      email: 'admin@example.com',
      role: 'admin',
      roles: ['owner'],
      permissions: [
        'can_view_orders',
        'can_manage_cars',
        'can_manage_pricing',
        'can_manage_fleet_alerts',
        'can_manage_contacts',
        'can_manage_payments_monitor',
        'can_view_revenue',
        'can_view_audit_logs',
        'can_view_reservations_ops',
        'can_manage_users',
        'can_view_calendar',
      ],
    },
    isLoading: false,
    login: vi.fn(),
    signup: vi.fn(),
    logout,
    refresh: vi.fn(),
  });
}

function renderAdminLayout(route = '/admin') {
  return renderWithRouter(
    <Routes>
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<div>Admin page content</div>} />
        <Route path="cars" element={<div>Cars page content</div>} />
      </Route>
    </Routes>,
    { route },
  );
}

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.mocked(getFleetAlerts).mockResolvedValue({
      summary: { total: 2, critical: 1, warning: 1, info: 0 },
      alerts: [],
    });
  });

  it('renders admin nav and outlet', async () => {
    mockOwnerAuth();
    renderAdminLayout();

    expect(screen.getByText('Admin page content')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Dashboard' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'Audit logs' }).length).toBeGreaterThan(0);
    expect(screen.getByTestId('admin-mobile-menu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Log out' })).toBeInTheDocument();
    expect((await screen.findAllByText(/Fleet alerts/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Live').length).toBeGreaterThan(0);
  });

  it('opens the mobile drawer and closes it from the Close control', async () => {
    mockOwnerAuth();
    renderAdminLayout();

    fireEvent.click(screen.getByTestId('admin-mobile-menu'));
    const drawer = await screen.findByRole('dialog', { name: 'Admin menu' });
    expect(within(drawer).getByRole('navigation', { name: 'Admin' })).toBeInTheDocument();

    fireEvent.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Admin menu' })).not.toBeInTheDocument();
    });
  });

  it('closes the mobile drawer after navigating to another admin page', async () => {
    mockOwnerAuth();
    renderAdminLayout();

    fireEvent.click(screen.getByTestId('admin-mobile-menu'));
    const drawer = await screen.findByRole('dialog', { name: 'Admin menu' });

    fireEvent.click(within(drawer).getByRole('link', { name: 'Cars' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Admin menu' })).not.toBeInTheDocument();
    });
    expect(screen.getByText('Cars page content')).toBeInTheDocument();
  });

  it('logs out from the mobile drawer and closes it', async () => {
    const logout = vi.fn();
    mockOwnerAuth(logout);
    renderAdminLayout();

    fireEvent.click(screen.getByTestId('admin-mobile-menu'));
    await screen.findByRole('dialog', { name: 'Admin menu' });

    fireEvent.click(screen.getByTestId('admin-mobile-logout'));

    expect(logout).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Admin menu' })).not.toBeInTheDocument();
    });
  });
});
