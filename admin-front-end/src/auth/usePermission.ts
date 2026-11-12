/**
 * React hooks for RBAC UI gating (buttons, nav items, page sections).
 */
import { useAuth } from './useAuth';
// Import named exports from './permissions'.
import { hasAnyPermission, hasPermission, isStaffUser } from './permissions';

/**
 * Whether the current user has a single permission key (owner = all).
 * @param key - Permission key to check
 */
export function usePermission(key: string): boolean {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Return the resulting value to the caller.
  return hasPermission(user, key);
}

/**
 * Whether the current user has any of the given permission keys.
 * @param keys - Permission keys (OR semantics)
 */
export function useAnyPermission(keys: string[]): boolean {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Return the resulting value to the caller.
  return hasAnyPermission(user, keys);
}

/**
 * Whether the current user is staff (has roles or permissions).
 */
export function useIsStaff(): boolean {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Return the resulting value to the caller.
  return isStaffUser(user);
}
