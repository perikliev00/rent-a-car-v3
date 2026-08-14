import type { AdminStaffUser, RoleSummary } from '../../types/api';
import { api } from '../client';

export async function getAdminUsers(): Promise<{ users: AdminStaffUser[] }> {
  return api<{ users: AdminStaffUser[] }>('/api/admin/users');
}

export async function createAdminUser(payload: {
  email: string;
  password: string;
  roleIds: string[];
}): Promise<{ user: AdminStaffUser }> {
  return api('/api/admin/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminUser(
  id: string,
  payload: { email?: string }
): Promise<{ user: AdminStaffUser }> {
  return api(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function putUserRoles(
  userId: string,
  roleIds: string[]
): Promise<{ userId: string; roles: RoleSummary[] }> {
  return api(`/api/admin/users/${userId}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roleIds }),
  });
}

export async function assignUserRole(
  userId: string,
  roleId: string
): Promise<{ userId: string; roles: RoleSummary[] }> {
  return api(`/api/admin/users/${userId}/roles/${roleId}`, { method: 'POST' });
}

export async function revokeUserRole(
  userId: string,
  roleId: string
): Promise<{ userId: string; roles: RoleSummary[] }> {
  return api(`/api/admin/users/${userId}/roles/${roleId}`, { method: 'DELETE' });
}
