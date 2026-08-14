import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('../client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import { getRbacCatalog, updateRolePermissions } from './rbac';

describe('admin rbac API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('getRbacCatalog fetches catalog', async () => {
    mockApi.mockResolvedValue({ roles: [], permissions: [], matrix: [] });
    await getRbacCatalog();
    expect(mockApi).toHaveBeenCalledWith('/api/admin/rbac');
  });

  it('updateRolePermissions puts permission keys', async () => {
    mockApi.mockResolvedValue({ roleId: '2', roleSlug: 'manager', permissions: ['can_view_orders'] });
    await updateRolePermissions('2', ['can_view_orders']);

    expect(mockApi).toHaveBeenCalledWith('/api/admin/rbac/roles/2/permissions', {
      method: 'PUT',
      body: JSON.stringify({ permissionKeys: ['can_view_orders'] }),
    });
  });
});
