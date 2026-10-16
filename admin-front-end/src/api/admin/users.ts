/**
 * Staff user CRUD and role assignment APIs for the Users admin page.
 */
import type { AdminStaffUser, RoleSummary } from '../../types/api';
import { api } from '../client';

/**
 * List all staff users (with roles) for the Users admin table.
 */
export async function getAdminUsers(): Promise<{ users: AdminStaffUser[] }> {
  return api<{ users: AdminStaffUser[] }>('/api/admin/users');
}

/**
 * Create a staff user and attach the given role ids in one request.
 *
 * @param payload.email - Login email
 * @param payload.password - Initial password (server hashes)
 * @param payload.roleIds - Role ids assigned at creation
 */
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

/**
 * Patch mutable staff-user fields (currently email only).
 *
 * @param id - Staff user id
 * @param payload.email - Optional new email
 */
export async function updateAdminUser(
  id: string,
  payload: { email?: string }
): Promise<{ user: AdminStaffUser }> {
  return api(`/api/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Replaces the user's full role set (used by the multi-select editor).
 *
 * @param userId - Staff user id
 * @param roleIds - Complete replacement set of role ids
 */
export async function putUserRoles(
  userId: string,
  roleIds: string[]
): Promise<{ userId: string; roles: RoleSummary[] }> {
  return api(`/api/admin/users/${userId}/roles`, {
    method: 'PUT',
    body: JSON.stringify({ roleIds }),
  });
}

/**
 * Add a single role to a staff user without clearing existing roles.
 *
 * @param userId - Staff user id
 * @param roleId - Role to assign
 */
export async function assignUserRole(
  userId: string,
  roleId: string
): Promise<{ userId: string; roles: RoleSummary[] }> {
  return api(`/api/admin/users/${userId}/roles/${roleId}`, { method: 'POST' });
}

/**
 * Remove a single role from a staff user.
 *
 * @param userId - Staff user id
 * @param roleId - Role to revoke
 */
export async function revokeUserRole(
  userId: string,
  roleId: string
): Promise<{ userId: string; roles: RoleSummary[] }> {
  return api(`/api/admin/users/${userId}/roles/${roleId}`, { method: 'DELETE' });
}
