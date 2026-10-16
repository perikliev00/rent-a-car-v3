/**
 * React hooks that bind {@link permissions} helpers to the current auth user.
 */
import { useAuth } from './useAuth';
import { hasAnyPermission, hasPermission, isStaffUser } from './permissions';

/**
 * Whether the signed-in user has a specific permission key.
 *
 * @param key - Permission string to check.
 * @returns `true` when the current auth user is granted the key (or is owner).
 */
export function usePermission(key: string): boolean {
  const { user } = useAuth();
  return hasPermission(user, key);
}

/**
 * Whether the signed-in user has any of the given permission keys.
 *
 * @param keys - Permission keys; success if any match.
 * @returns `true` when the current auth user matches any key (or is owner).
 */
export function useAnyPermission(keys: string[]): boolean {
  const { user } = useAuth();
  return hasAnyPermission(user, keys);
}

/**
 * Whether the signed-in user is staff (has any RBAC role or permission).
 *
 * @returns `true` for staff users; `false` for customers and anonymous sessions.
 */
export function useIsStaff(): boolean {
  const { user } = useAuth();
  return isStaffUser(user);
}
