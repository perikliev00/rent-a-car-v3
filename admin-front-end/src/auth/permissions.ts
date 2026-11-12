/**
 * Pure RBAC helpers for UI gating.
 * Owner role short-circuits to all permissions; legacy users.role is ignored.
 */
import type { User } from '../types/api';

/**
 * Staff access comes only from RBAC roles/permissions — never from users.role alone.
 * @param user - Session user (or null/undefined when logged out)
 */
export function isStaffUser(user: Pick<User, 'roles' | 'permissions'> | null | undefined): boolean {
  // Evaluate the condition and enter the branch when it is true.
  if (!user) return false;
  // Any assigned role marks the account as staff.
  if ((user.roles?.length ?? 0) > 0) return true;
  // Or any granted permission (edge case without role rows).
  if ((user.permissions?.length ?? 0) > 0) return true;
  // Return the resulting value to the caller.
  return false;
}

/**
 * True if the user has `key`, or holds the privileged `owner` role.
 * @param user - Session user
 * @param key - Permission key to check
 */
export function hasPermission(
  // Provide the user field value.
  user: Pick<User, 'roles' | 'permissions'> | null | undefined,
  // Provide the key field value.
  key: string
// Continue the surrounding logic with this statement.
): boolean {
  // Evaluate the condition and enter the branch when it is true.
  if (!user) return false;
  // Owner bypasses the permission matrix.
  if ((user.roles || []).includes('owner')) return true;
  // Return the resulting value to the caller.
  return (user.permissions || []).includes(key);
}

/**
 * True if the user has any of `keys`, or holds the privileged `owner` role.
 * @param user - Session user
 * @param keys - Permission keys (OR semantics)
 */
export function hasAnyPermission(
  // Provide the user field value.
  user: Pick<User, 'roles' | 'permissions'> | null | undefined,
  // Provide the keys field value.
  keys: string[]
// Continue the surrounding logic with this statement.
): boolean {
  // Evaluate the condition and enter the branch when it is true.
  if (!user) return false;
  // Evaluate the condition and enter the branch when it is true.
  if ((user.roles || []).includes('owner')) return true;
  // Set for O(1) membership checks across the key list.
  const set = new Set(user.permissions || []);
  // Return the resulting value to the caller.
  return keys.some((k) => set.has(k));
}
