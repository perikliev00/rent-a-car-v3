/**
 * Admin RBAC catalog and role-permission update handlers.
 */
const rbacService = require('../../../services/rbac/rbacService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../services/admin/adminAuditService');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Map known RBAC service errors to API responses; return true if handled.
 * Side effects: may write an API error response when `err` has status/code.
 * @param {Error&{status?: number, code?: string}} err
 * @param {import('express').Response} res
 * @returns {import('express').Response|null} Response when mapped, otherwise null
 */
function mapServiceError(err, res) {
  // Evaluate the condition and enter the branch when it is true.
  if (err?.status && err?.code) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Create the catalog constant.
    const catalog = await rbacService.getRbacCatalog();
    // Return the resulting value to the caller.
    return apiResponse.success(res, catalog);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.getRbacCatalog',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Accept either naming convention from older/newer admin UIs.
    const permissionKeys = req.body?.permissionKeys || req.body?.permissions || [];
    // Create the result constant.
    const result = await rbacService.updateRolePermissions(req.params.roleId, permissionKeys);
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'rbac.role.permissions.update',
      // Provide the entity type field value.
      entityType: 'role',
      // Provide the entity id field value.
      entityId: result.roleId,
      // Provide the metadata field value.
      metadata: { roleSlug: result.roleSlug, permissionKeys: result.permissions },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, result);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.updateRolePermissions',
      // Provide the public message field value.
      publicMessage: 'Error updating role permissions.',
    });
  }
});
