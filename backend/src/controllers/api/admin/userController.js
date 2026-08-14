const userAdminService = require('../../../services/admin/userAdminService');
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

exports.createUser = asyncHandler(async (req, res, next) => {
  try {
    const { email, password, roleIds } = req.body || {};
    const user = await userAdminService.createStaffUser({ email, password, roleIds });
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

exports.updateUser = asyncHandler(async (req, res, next) => {
  try {
    const user = await userAdminService.updateStaffUser(req.params.id, {
      email: req.body?.email,
    });
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

exports.putUserRoles = asyncHandler(async (req, res, next) => {
  try {
    const roleIds = req.body?.roleIds || [];
    const result = await rbacService.setUserRoles(
      req.params.id,
      roleIds,
      req.session?.user?.id
    );
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

exports.assignUserRole = asyncHandler(async (req, res, next) => {
  try {
    const result = await rbacService.assignUserRole(
      req.params.id,
      req.params.roleId,
      req.session?.user?.id
    );
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

exports.revokeUserRole = asyncHandler(async (req, res, next) => {
  try {
    const result = await rbacService.revokeUserRole(req.params.id, req.params.roleId);
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
