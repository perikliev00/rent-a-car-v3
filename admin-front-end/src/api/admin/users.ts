/**
 * Staff user CRUD and role assignment APIs for the Users admin page.
 */
import type { AdminStaffUser, RoleSummary } from '../../types/api';
// Import named exports from '../client'.
import { api } from '../client';

/**
 * List all staff users (with roles) for the Users admin table.
 */
export async function getAdminUsers(): Promise<{ users: AdminStaffUser[] }> {
  // Return the resulting value to the caller.
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
  // Provide the email field value.
  email: string;
  // Provide the password field value.
  password: string;
  // Provide the role ids field value.
  roleIds: string[];
// Continue the surrounding logic with this statement.
}): Promise<{ user: AdminStaffUser }> {
  // Return the resulting value to the caller.
  return api('/api/admin/users', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
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
  // Provide the id field value.
  id: string,
  // Provide the payload field value.
  payload: { email?: string }
// Continue the surrounding logic with this statement.
): Promise<{ user: AdminStaffUser }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/users/${id}`, {
    // Provide the method field value.
    method: 'PATCH',
    // Provide the body field value.
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
  // Provide the user id field value.
  userId: string,
  // Provide the role ids field value.
  roleIds: string[]
// Continue the surrounding logic with this statement.
): Promise<{ userId: string; roles: RoleSummary[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/users/${userId}/roles`, {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
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
  // Provide the user id field value.
  userId: string,
  // Provide the role id field value.
  roleId: string
// Continue the surrounding logic with this statement.
): Promise<{ userId: string; roles: RoleSummary[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/users/${userId}/roles/${roleId}`, { method: 'POST' });
}

/**
 * Remove a single role from a staff user.
 *
 * @param userId - Staff user id
 * @param roleId - Role to revoke
 */
export async function revokeUserRole(
  // Provide the user id field value.
  userId: string,
  // Provide the role id field value.
  roleId: string
// Continue the surrounding logic with this statement.
): Promise<{ userId: string; roles: RoleSummary[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/users/${userId}/roles/${roleId}`, { method: 'DELETE' });
}
