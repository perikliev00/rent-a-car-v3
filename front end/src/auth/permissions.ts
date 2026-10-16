/**
 * Client-side RBAC helpers mirroring server permission checks.
 * Staff detection and permission grants must use roles/permissions arrays —
 * never the legacy `users.role` field alone.
 */
import type { User } from '../types/api';

/**
 * Whether the user is treated as staff for client-side gating.
 *
 * @param user - User (or partial) with `roles` / `permissions`, or null/undefined when anonymous.
 * @returns `true` when the user has any RBAC role or permission.
 * @remarks Staff access comes only from RBAC roles/permissions — never from `users.role` alone.
 */
export function isStaffUser(user: Pick<User, 'roles' | 'permissions'> | null | undefined): boolean {
  if (!user) return false;
  // Any assigned role implies staff tooling access.
  if ((user.roles?.length ?? 0) > 0) return true;
  // Permissions without roles still count (edge grants).
  if ((user.permissions?.length ?? 0) > 0) return true;
  return false;
}

/**
 * Whether the user holds a specific permission key.
 *
 * @param user - User (or partial) with `roles` / `permissions`, or null/undefined when anonymous.
 * @param key - Permission string to check (e.g. `orders.read`).
 * @returns `true` when the user is `owner` or lists the key in `permissions`.
 * @remarks The `owner` role is treated as a full grant for client-side UI gating.
 */
export function hasPermission(
  user: Pick<User, 'roles' | 'permissions'> | null | undefined,
  key: string
): boolean {
  if (!user) return false;
  // Owner bypasses per-key checks in the SPA (server still enforces).
  if ((user.roles || []).includes('owner')) return true;
  return (user.permissions || []).includes(key);
}

/**
 * Whether the user has at least one of the given permission keys (or is owner).
 *
 * @param user - User (or partial) with `roles` / `permissions`, or null/undefined when anonymous.
 * @param keys - Permission keys; success if any match.
 * @returns `true` when owner or any key is present in `permissions`.
 */
export function hasAnyPermission(
  user: Pick<User, 'roles' | 'permissions'> | null | undefined,
  keys: string[]
): boolean {
  if (!user) return false;
  if ((user.roles || []).includes('owner')) return true;
  // Set lookup keeps multi-key checks O(n) in keys, not nested scans.
  const set = new Set(user.permissions || []);
  return keys.some((k) => set.has(k));
}
