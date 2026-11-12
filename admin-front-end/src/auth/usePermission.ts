/**
 * React hooks for RBAC UI gating (buttons, nav items, page sections).
 */
import { useAuth } from './useAuth';
import { hasAnyPermission, hasPermission, isStaffUser } from './permissions';

/**
 * Whether the current user has a single permission key (owner = all).
 * @param key - Permission key to check
 */
export function usePermission(key: string): boolean {
  const { user } = useAuth();
  return hasPermission(user, key);
}

/**
 * Whether the current user has any of the given permission keys.
 * @param keys - Permission keys (OR semantics)
 */
export function useAnyPermission(keys: string[]): boolean {
  const { user } = useAuth();
  return hasAnyPermission(user, keys);
}

/**
 * Whether the current user is staff (has roles or permissions).
 */
export function useIsStaff(): boolean {
  const { user } = useAuth();
  return isStaffUser(user);
}
