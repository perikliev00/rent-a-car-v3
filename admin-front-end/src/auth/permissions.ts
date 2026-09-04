import type { User } from '../types/api';

/** Staff access comes only from RBAC roles/permissions — never from users.role alone. */
export function isStaffUser(user: Pick<User, 'roles' | 'permissions'> | null | undefined): boolean {
  if (!user) return false;
  if ((user.roles?.length ?? 0) > 0) return true;
  if ((user.permissions?.length ?? 0) > 0) return true;
  return false;
}

export function hasPermission(
  user: Pick<User, 'roles' | 'permissions'> | null | undefined,
  key: string
): boolean {
  if (!user) return false;
  if ((user.roles || []).includes('owner')) return true;
  return (user.permissions || []).includes(key);
}

export function hasAnyPermission(
  user: Pick<User, 'roles' | 'permissions'> | null | undefined,
  keys: string[]
): boolean {
  if (!user) return false;
  if ((user.roles || []).includes('owner')) return true;
  const set = new Set(user.permissions || []);
  return keys.some((k) => set.has(k));
}
