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
