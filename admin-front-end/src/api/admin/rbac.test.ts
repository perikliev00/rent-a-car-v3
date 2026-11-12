// Import named exports from 'vitest'.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Create the mock api constant.
const mockApi = vi.fn();

// Call vi.mock to perform this step.
vi.mock('../client', () => ({
  // Provide the api field value.
  api: (...args: unknown[]) => mockApi(...args),
}));

// Import named exports from './rbac'.
import { getRbacCatalog, updateRolePermissions } from './rbac';

// Declare a test suite grouping related cases.
describe('admin rbac API', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call mockApi.mockReset to perform this step.
    mockApi.mockReset();
  });

  // Define a single test case and its expectations.
  it('getRbacCatalog fetches catalog', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ roles: [], permissions: [], matrix: [] });
    // Wait until the asynchronous operation resolves.
    await getRbacCatalog();
    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/rbac');
  });

  // Define a single test case and its expectations.
  it('updateRolePermissions puts permission keys', async () => {
    // Call mockApi.mockResolvedValue to perform this step.
    mockApi.mockResolvedValue({ roleId: '2', roleSlug: 'manager', permissions: ['can_view_orders'] });
    // Wait until the asynchronous operation resolves.
    await updateRolePermissions('2', ['can_view_orders']);

    // Assert that the value matches the intended expectation.
    expect(mockApi).toHaveBeenCalledWith('/api/admin/rbac/roles/2/permissions', {
      // Provide the method field value.
      method: 'PUT',
      // Provide the body field value.
      body: JSON.stringify({ permissionKeys: ['can_view_orders'] }),
    });
  });
});
