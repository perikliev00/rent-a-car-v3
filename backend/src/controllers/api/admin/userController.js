/**
 * Admin user CRUD and role-assignment handlers.
 */
const userAdminService = require('../../../services/admin/userAdminService');
const rbacService = require('../../../services/rbac/rbacService');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Map known user-service errors to API responses; return the response if handled.
 * Side effects: may write an API error response when `err` has status/code.
 * @param {Error&{status?: number, code?: string}} err
 * @param {import('express').Response} res
 * @returns {import('express').Response|null}
 */
function mapServiceError(err, res) {
  if (err?.status && err?.code) {
    return apiResponse.error(res, err.code, err.message, err.status);
  }
  return null;
}

/**
 * List users for admin management.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listUsers = asyncHandler(async (req, res, next) => {
  try {
    const users = await userAdminService.listUsers();
    return apiResponse.success(res, { users });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.admin.listUsers',
      publicMessage: 'Error loading users.',
    });
  }
});

/**
 * Return a user by id.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getUser = asyncHandler(async (req, res, next) => {
  try {
    const user = await userAdminService.getUser(req.params.id);
    return apiResponse.success(res, { user });
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.getUser',
      publicMessage: 'Error loading user.',
    });
  }
});

/**
 * Create a staff/customer user.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.createUser = asyncHandler(async (req, res, next) => {
  try {
    const { email, password, roleIds } = req.body || {};
    const user = await userAdminService.createStaffUser({ email, password, roleIds });
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'user.create',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email, roleIds: user.roles.map((r) => r.id) },
    });
    return apiResponse.success(res, { user }, 201);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.createUser',
      publicMessage: 'Error creating user.',
    });
  }
});

/**
 * Update user profile fields.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateUser = asyncHandler(async (req, res, next) => {
  try {
    const user = await userAdminService.updateStaffUser(req.params.id, {
      email: req.body?.email,
    });
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'user.update',
      entityType: 'user',
      entityId: user.id,
      metadata: { email: user.email },
    });
    return apiResponse.success(res, { user });
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.updateUser',
      publicMessage: 'Error updating user.',
    });
  }
});

/**
 * Replace all roles for a user.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.putUserRoles = asyncHandler(async (req, res, next) => {
  try {
    const roleIds = req.body?.roleIds || [];
    const result = await rbacService.setUserRoles(
      req.params.id,
      roleIds,
      req.session?.user?.id
    );
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'user.roles.replace',
      entityType: 'user',
      entityId: result.userId,
      metadata: { roleIds: result.roles.map((r) => r.id) },
    });
    return apiResponse.success(res, result);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.putUserRoles',
      publicMessage: 'Error updating user roles.',
    });
  }
});

/**
 * Assign a single role to a user.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.assignUserRole = asyncHandler(async (req, res, next) => {
  try {
    const result = await rbacService.assignUserRole(
      req.params.id,
      req.params.roleId,
      req.session?.user?.id
    );
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'user.role.assign',
      entityType: 'user',
      entityId: result.userId,
      metadata: { roleId: String(req.params.roleId) },
    });
    return apiResponse.success(res, result);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.assignUserRole',
      publicMessage: 'Error assigning role.',
    });
  }
});

/**
 * Revoke a single role from a user.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.revokeUserRole = asyncHandler(async (req, res, next) => {
  try {
    const result = await rbacService.revokeUserRole(req.params.id, req.params.roleId);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'user.role.revoke',
      entityType: 'user',
      entityId: result.userId,
      metadata: { roleId: String(req.params.roleId) },
    });
    return apiResponse.success(res, result);
  } catch (err) {
    const mapped = mapServiceError(err, res);
    if (mapped) return mapped;
    return forwardControllerError(err, req, next, {
      context: 'api.admin.revokeUserRole',
      publicMessage: 'Error revoking role.',
    });
  }
});
