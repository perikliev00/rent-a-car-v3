import { useAuth } from './useAuth';
import { hasAnyPermission, hasPermission, isStaffUser } from './permissions';

export function usePermission(key: string): boolean {
  const { user } = useAuth();
  return hasPermission(user, key);
}

export function useAnyPermission(keys: string[]): boolean {
  const { user } = useAuth();
  return hasAnyPermission(user, keys);
}

export function useIsStaff(): boolean {
  const { user } = useAuth();
  return isStaffUser(user);
}
