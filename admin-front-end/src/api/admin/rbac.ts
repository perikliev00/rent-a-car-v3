/**
 * RBAC catalog and role-permission matrix APIs for the Roles admin page.
 */
import type {
  // Contribute this line to the enclosing declaration or statement.
  PermissionSummary,
  // Contribute this line to the enclosing declaration or statement.
  RolePermissionMatrixEntry,
  // Contribute this line to the enclosing declaration or statement.
  RoleSummary,
// Contribute this line to the enclosing declaration or statement.
} from '../../types/api';
// Import named exports from '../client'.
import { api } from '../client';

/**
 * Full roles + permissions + matrix used to render the RBAC editor.
 */
export async function getRbacCatalog(): Promise<{
  // Provide the roles field value.
  roles: RoleSummary[];
  // Provide the permissions field value.
  permissions: PermissionSummary[];
  // Provide the matrix field value.
  matrix: RolePermissionMatrixEntry[];
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api('/api/admin/rbac');
}

/**
 * Replaces a role's permission set (full PUT, not a patch merge).
 *
 * @param roleId - Role id
 * @param permissionKeys - Complete replacement list of permission keys
 */
export async function updateRolePermissions(
  // Provide the role id field value.
  roleId: string,
  // Provide the permission keys field value.
  permissionKeys: string[]
// Continue the surrounding logic with this statement.
): Promise<{ roleId: string; roleSlug: string; permissions: string[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/rbac/roles/${roleId}/permissions`, {
    // Provide the method field value.
    method: 'PUT',
    // Provide the body field value.
    body: JSON.stringify({ permissionKeys }),
  });
}
