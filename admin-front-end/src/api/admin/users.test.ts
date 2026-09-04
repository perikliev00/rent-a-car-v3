import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApi = vi.fn();

vi.mock('../client', () => ({
  api: (...args: unknown[]) => mockApi(...args),
}));

import {
  assignUserRole,
  createAdminUser,
  getAdminUsers,
  putUserRoles,
  revokeUserRole,
  updateAdminUser,
} from './users';

describe('admin users API', () => {
  beforeEach(() => {
    mockApi.mockReset();
  });

  it('getAdminUsers fetches list', async () => {
    mockApi.mockResolvedValue({ users: [] });
    await getAdminUsers();
    expect(mockApi).toHaveBeenCalledWith('/api/admin/users');
  });

  it('createAdminUser posts payload', async () => {
    mockApi.mockResolvedValue({ user: { id: '1' } });
    await createAdminUser({
      email: 'staff@example.com',
      password: 'Secret123!',
      roleIds: ['3'],
    });

    expect(mockApi).toHaveBeenCalledWith('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify({
        email: 'staff@example.com',
        password: 'Secret123!',
        roleIds: ['3'],
      }),
    });
  });

  it('updateAdminUser patches email', async () => {
    mockApi.mockResolvedValue({ user: { id: '9' } });
    await updateAdminUser('9', { email: 'new@example.com' });

    expect(mockApi).toHaveBeenCalledWith('/api/admin/users/9', {
      method: 'PATCH',
      body: JSON.stringify({ email: 'new@example.com' }),
    });
  });

  it('putUserRoles replaces roles', async () => {
    mockApi.mockResolvedValue({ userId: '9', roles: [] });
    await putUserRoles('9', ['2', '3']);

    expect(mockApi).toHaveBeenCalledWith('/api/admin/users/9/roles', {
      method: 'PUT',
      body: JSON.stringify({ roleIds: ['2', '3'] }),
    });
  });

  it('assignUserRole posts role id', async () => {
    mockApi.mockResolvedValue({ userId: '9', roles: [] });
    await assignUserRole('9', '3');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/users/9/roles/3', { method: 'POST' });
  });

  it('revokeUserRole deletes role id', async () => {
    mockApi.mockResolvedValue({ userId: '9', roles: [] });
    await revokeUserRole('9', '3');

    expect(mockApi).toHaveBeenCalledWith('/api/admin/users/9/roles/3', { method: 'DELETE' });
  });
});
