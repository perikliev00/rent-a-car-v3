import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAdminUsers } from '../../api/admin/users';
import { getRbacCatalog } from '../../api/admin/rbac';
import { renderWithRouter } from '../../test/test-utils';
import { AdminUsersPage } from './AdminUsersPage';

vi.mock('../../api/admin/users', () => ({
  getAdminUsers: vi.fn(),
  createAdminUser: vi.fn(),
  putUserRoles: vi.fn(),
}));

vi.mock('../../api/admin/rbac', () => ({
  getRbacCatalog: vi.fn(),
}));

describe('AdminUsersPage', () => {
  beforeEach(() => {
    vi.mocked(getAdminUsers).mockResolvedValue({
      users: [
        {
          id: '1',
          email: 'admin@example.com',
          role: 'admin',
          roles: [{ id: '1', slug: 'owner', name: 'Owner' }],
        },
      ],
    });
    vi.mocked(getRbacCatalog).mockResolvedValue({
      roles: [{ id: '1', slug: 'owner', name: 'Owner' }],
      permissions: [],
      matrix: [],
    });
  });

  it('renders users page and staff list', async () => {
    renderWithRouter(<AdminUsersPage />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    });

    expect(screen.getByRole('heading', { name: 'Create staff user' })).toBeInTheDocument();
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });
});
