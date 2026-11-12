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
  if (!user) return false;
  // Any assigned role marks the account as staff.
  if ((user.roles?.length ?? 0) > 0) return true;
  // Or any granted permission (edge case without role rows).
  if ((user.permissions?.length ?? 0) > 0) return true;
  return false;
}

/**
 * True if the user has `key`, or holds the privileged `owner` role.
 * @param user - Session user
 * @param key - Permission key to check
 */
export function hasPermission(
  user: Pick<User, 'roles' | 'permissions'> | null | undefined,
  key: string
): boolean {
  if (!user) return false;
  // Owner bypasses the permission matrix.
  if ((user.roles || []).includes('owner')) return true;
  return (user.permissions || []).includes(key);
}

/**
 * True if the user has any of `keys`, or holds the privileged `owner` role.
 * @param user - Session user
 * @param keys - Permission keys (OR semantics)
 */
export function hasAnyPermission(
  user: Pick<User, 'roles' | 'permissions'> | null | undefined,
  keys: string[]
): boolean {
  if (!user) return false;
  if ((user.roles || []).includes('owner')) return true;
  // Set for O(1) membership checks across the key list.
  const set = new Set(user.permissions || []);
  return keys.some((k) => set.has(k));
}
