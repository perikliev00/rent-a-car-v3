const rbacService = require('../../../services/rbac/rbacService');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

function mapServiceError(err, res) {
  if (err?.status && err?.code) {
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  return null;
}

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

exports.updateRolePermissions = asyncHandler(async (req, res, next) => {
  try {
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
