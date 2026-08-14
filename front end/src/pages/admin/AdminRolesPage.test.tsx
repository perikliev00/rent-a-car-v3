import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRbacCatalog } from '../../api/admin/rbac';
import { renderWithRouter } from '../../test/test-utils';
import { AdminRolesPage } from './AdminRolesPage';

vi.mock('../../api/admin/rbac', () => ({
  getRbacCatalog: vi.fn(),
  updateRolePermissions: vi.fn(),
}));

describe('AdminRolesPage', () => {
  beforeEach(() => {
    vi.mocked(getRbacCatalog).mockResolvedValue({
      roles: [
        { id: '1', slug: 'owner', name: 'Owner' },
        { id: '2', slug: 'manager', name: 'Manager' },
      ],
      permissions: [
        {
          id: '1',
          key: 'can_view_orders',
          name: 'View orders',
          category: 'orders',
        },
      ],
      matrix: [
        {
          roleId: '2',
          roleSlug: 'manager',
          permissionKeys: ['can_view_orders'],
          permissionIds: ['1'],
        },
      ],
    });
  });

  it('renders roles page with permission matrix', async () => {
    renderWithRouter(<AdminRolesPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Roles' })).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /Manager/ })).toBeInTheDocument();
    expect(screen.getByText('View orders')).toBeInTheDocument();
  });
});
