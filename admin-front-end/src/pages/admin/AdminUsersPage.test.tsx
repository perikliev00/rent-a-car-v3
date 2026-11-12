// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/users'.
import { getAdminUsers } from '../../api/admin/users';
// Import named exports from '../../api/admin/rbac'.
import { getRbacCatalog } from '../../api/admin/rbac';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminUsersPage'.
import { AdminUsersPage } from './AdminUsersPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/users', () => ({
  // Provide the get admin users field value.
  getAdminUsers: vi.fn(),
  // Provide the create admin user field value.
  createAdminUser: vi.fn(),
  // Provide the put user roles field value.
  putUserRoles: vi.fn(),
}));

// Call vi.mock to perform this step.
vi.mock('../../api/admin/rbac', () => ({
  // Provide the get rbac catalog field value.
  getRbacCatalog: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('AdminUsersPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getAdminUsers).mockResolvedValue({
      // Provide the users field value.
      users: [
        {
          // Provide the id field value.
          id: '1',
          // Provide the email field value.
          email: 'admin@example.com',
          // Provide the role field value.
          role: 'admin',
          // Provide the roles field value.
          roles: [{ id: '1', slug: 'owner', name: 'Owner' }],
        },
      ],
    });
    // Call vi.mocked to perform this step.
    vi.mocked(getRbacCatalog).mockResolvedValue({
      // Provide the roles field value.
      roles: [{ id: '1', slug: 'owner', name: 'Owner' }],
      // Provide the permissions field value.
      permissions: [],
      // Provide the matrix field value.
      matrix: [],
    });
  });

  // Define a single test case and its expectations.
  it('renders users page and staff list', async () => {
    renderWithRouter(<AdminUsersPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Users' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('heading', { name: 'Create staff user' })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  });
});
