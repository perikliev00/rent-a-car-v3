/**
 * Admin RBAC catalog and role-permission update handlers.
 */
const rbacService = require('../../../services/rbac/rbacService');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Map known RBAC service errors to API responses; return true if handled.
 * Side effects: may write an API error response when `err` has status/code.
 * @param {Error&{status?: number, code?: string}} err
 * @param {import('express').Response} res
 * @returns {import('express').Response|null} Response when mapped, otherwise null
 */
function mapServiceError(err, res) {
  if (err?.status && err?.code) {
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  return null;
}

/**
 * Return RBAC roles and permissions catalog.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getCatalog = asyncHandler(async (req, res, next) => {
  try {
    const catalog = await rbacService.getRbacCatalog();
    return apiResponse.success(res, catalog);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.admin.getRbacCatalog',
      publicMessage: 'Error loading roles and permissions.',
    });
  }
});

/**
 * Replace permissions assigned to a role.
 * Side effects: updates role-permission rows and writes an admin audit entry.
 * @param {import('express').Request} req - Params: roleId; body: permissionKeys | permissions
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateRolePermissions = asyncHandler(async (req, res, next) => {
  try {
    // Accept either naming convention from older/newer admin UIs.
    const permissionKeys = req.body?.permissionKeys || req.body?.permissions || [];
    const result = await rbacService.updateRolePermissions(req.params.roleId, permissionKeys);
    await logAdminAction(req, {
      action: 'rbac.role.permissions.update',
      entityType: 'role',
      entityId: result.roleId,
      metadata: { roleSlug: result.roleSlug, permissionKeys: result.permissions },
    });
    return apiResponse.success(res, result);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.updateRolePermissions',
      publicMessage: 'Error updating role permissions.',
    });
  }
});
