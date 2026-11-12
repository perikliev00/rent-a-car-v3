/**
 * Admin user CRUD and role-assignment handlers.
 */
const userAdminService = require('../../../services/admin/userAdminService');
// Require the '../../../services/rbac/rbacService' module as rbacService.
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
 * Map known user-service errors to API responses; return the response if handled.
 * Side effects: may write an API error response when `err` has status/code.
 * @param {Error&{status?: number, code?: string}} err
 * @param {import('express').Response} res
 * @returns {import('express').Response|null}
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
 * List users for admin management.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listUsers = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the users constant.
    const users = await userAdminService.listUsers();
    // Return the resulting value to the caller.
    return apiResponse.success(res, { users });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.listUsers',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the user constant.
    const user = await userAdminService.getUser(req.params.id);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { user });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.getUser',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { email, password, roleIds } = req.body || {};
    // Create the user constant.
    const user = await userAdminService.createStaffUser({ email, password, roleIds });
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'user.create',
      // Provide the entity type field value.
      entityType: 'user',
      // Provide the entity id field value.
      entityId: user.id,
      // Provide the metadata field value.
      metadata: { email: user.email, roleIds: user.roles.map((r) => r.id) },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { user }, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.createUser',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the user constant.
    const user = await userAdminService.updateStaffUser(req.params.id, {
      // Provide the email field value.
      email: req.body?.email,
    });
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'user.update',
      // Provide the entity type field value.
      entityType: 'user',
      // Provide the entity id field value.
      entityId: user.id,
      // Provide the metadata field value.
      metadata: { email: user.email },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { user });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Create the mapped constant.
    const mapped = mapServiceError(err, res);
    // Evaluate the condition and enter the branch when it is true.
    if (mapped) return mapped;
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.admin.updateUser',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the role ids constant.
    const roleIds = req.body?.roleIds || [];
    // Create the result constant.
    const result = await rbacService.setUserRoles(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      roleIds,
      // Contribute this line to the enclosing declaration or statement.
      req.session?.user?.id
    );
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'user.roles.replace',
      // Provide the entity type field value.
      entityType: 'user',
      // Provide the entity id field value.
      entityId: result.userId,
      // Provide the metadata field value.
      metadata: { roleIds: result.roles.map((r) => r.id) },
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
      context: 'api.admin.putUserRoles',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await rbacService.assignUserRole(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.params.roleId,
      // Contribute this line to the enclosing declaration or statement.
      req.session?.user?.id
    );
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'user.role.assign',
      // Provide the entity type field value.
      entityType: 'user',
      // Provide the entity id field value.
      entityId: result.userId,
      // Provide the metadata field value.
      metadata: { roleId: String(req.params.roleId) },
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
      context: 'api.admin.assignUserRole',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await rbacService.revokeUserRole(req.params.id, req.params.roleId);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'user.role.revoke',
      // Provide the entity type field value.
      entityType: 'user',
      // Provide the entity id field value.
      entityId: result.userId,
      // Provide the metadata field value.
      metadata: { roleId: String(req.params.roleId) },
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
      context: 'api.admin.revokeUserRole',
      // Provide the public message field value.
      publicMessage: 'Error revoking role.',
    });
  }
});
