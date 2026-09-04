import type {
  PermissionSummary,
  RolePermissionMatrixEntry,
  RoleSummary,
} from '../../types/api';
import { api } from '../client';

export async function getRbacCatalog(): Promise<{
  roles: RoleSummary[];
  permissions: PermissionSummary[];
  matrix: RolePermissionMatrixEntry[];
}> {
  return api('/api/admin/rbac');
}

export async function updateRolePermissions(
  roleId: string,
  permissionKeys: string[]
): Promise<{ roleId: string; roleSlug: string; permissions: string[] }> {
  return api(`/api/admin/rbac/roles/${roleId}/permissions`, {
    method: 'PUT',
    body: JSON.stringify({ permissionKeys }),
  });
}
