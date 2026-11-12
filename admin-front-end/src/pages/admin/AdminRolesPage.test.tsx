// Import named exports from '@testing-library/react'.
import { screen, waitFor } from '@testing-library/react';
// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from '../../api/admin/rbac'.
import { getRbacCatalog } from '../../api/admin/rbac';
// Import named exports from '../../test/test-utils'.
import { renderWithRouter } from '../../test/test-utils';
// Import named exports from './AdminRolesPage'.
import { AdminRolesPage } from './AdminRolesPage';

// Call vi.mock to perform this step.
vi.mock('../../api/admin/rbac', () => ({
  // Provide the get rbac catalog field value.
  getRbacCatalog: vi.fn(),
  // Provide the update role permissions field value.
  updateRolePermissions: vi.fn(),
}));

// Declare a test suite grouping related cases.
describe('AdminRolesPage', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.mocked to perform this step.
    vi.mocked(getRbacCatalog).mockResolvedValue({
      // Provide the roles field value.
      roles: [
        // Contribute this line to the enclosing declaration or statement.
        { id: '1', slug: 'owner', name: 'Owner' },
        // Contribute this line to the enclosing declaration or statement.
        { id: '2', slug: 'manager', name: 'Manager' },
      ],
      // Provide the permissions field value.
      permissions: [
        {
          // Provide the id field value.
          id: '1',
          // Provide the key field value.
          key: 'can_view_orders',
          // Provide the name field value.
          name: 'View orders',
          // Provide the category field value.
          category: 'orders',
        },
      ],
      // Provide the matrix field value.
      matrix: [
        {
          // Provide the role id field value.
          roleId: '2',
          // Provide the role slug field value.
          roleSlug: 'manager',
          // Provide the permission keys field value.
          permissionKeys: ['can_view_orders'],
          // Provide the permission ids field value.
          permissionIds: ['1'],
        },
      ],
    });
  });

  // Define a single test case and its expectations.
  it('renders roles page with permission matrix', async () => {
    renderWithRouter(<AdminRolesPage />);

    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(screen.getByRole('heading', { name: 'Roles' })).toBeInTheDocument();
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: /Manager/ })).toBeInTheDocument();
    // Assert that the value matches the intended expectation.
    expect(screen.getByText('View orders')).toBeInTheDocument();
  });
});
