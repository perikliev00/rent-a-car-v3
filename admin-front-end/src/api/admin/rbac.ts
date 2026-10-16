/**
 * RBAC catalog and role-permission matrix APIs for the Roles admin page.
 */
import type {
  PermissionSummary,
  RolePermissionMatrixEntry,
  RoleSummary,
} from '../../types/api';
import { api } from '../client';

/**
 * Full roles + permissions + matrix used to render the RBAC editor.
 */
export async function getRbacCatalog(): Promise<{
  roles: RoleSummary[];
  permissions: PermissionSummary[];
  matrix: RolePermissionMatrixEntry[];
}> {
  return api('/api/admin/rbac');
}

/**
 * Replaces a role's permission set (full PUT, not a patch merge).
 *
 * @param roleId - Role id
 * @param permissionKeys - Complete replacement list of permission keys
 */
export async function updateRolePermissions(
  roleId: string,
  permissionKeys: string[]
): Promise<{ roleId: string; roleSlug: string; permissions: string[] }> {
  return api(`/api/admin/rbac/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionKeys }),
  });
}
