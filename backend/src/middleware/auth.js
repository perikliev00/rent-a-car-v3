const apiResponse = require('../utils/apiResponse');
const rbacService = require('../services/rbac/rbacService');

function requireAuthApi(req, res, next) {
  if (!req.session || !req.session.isLoggedIn || !req.session.user) {
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  return next();
}

function sessionAccess(req) {
  const user = req.session?.user || {};
  return {
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

function requireStaffApi(req, res, next) {
  if (!req.session || !req.session.isLoggedIn || !req.session.user) {
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  const access = sessionAccess(req);
  if (!rbacService.isStaffAccess(access)) {
    return apiResponse.error(
      res,
      'FORBIDDEN',
      'You do not have permission to access this resource.',
      403
    );
  }

  return next();
}

/**
 * Staff gate — any assigned RBAC role / permissions.
 * Prefer requirePermission / requireStaffApi on new routes.
 */
function requireAdminApi(req, res, next) {
  return requireStaffApi(req, res, next);
}

function requirePermission(permissionKey) {
  return function requirePermissionMiddleware(req, res, next) {
    if (!req.session || !req.session.isLoggedIn || !req.session.user) {
      return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
    }

    const access = sessionAccess(req);
    if (!rbacService.isStaffAccess(access)) {
      return apiResponse.error(
        res,
        'FORBIDDEN',
        'You do not have permission to access this resource.',
        403
      );
    }

    if (!rbacService.userHasPermission(access, permissionKey)) {
      return apiResponse.error(
        res,
        'FORBIDDEN',
        'You do not have permission to access this resource.',
        403
      );
    }

    return next();
  };
}

function requireAnyPermission(permissionKeys) {
  const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];
  return function requireAnyPermissionMiddleware(req, res, next) {
    if (!req.session || !req.session.isLoggedIn || !req.session.user) {
      return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
    }

    const access = sessionAccess(req);
    if (!rbacService.isStaffAccess(access)) {
      return apiResponse.error(
        res,
        'FORBIDDEN',
        'You do not have permission to access this resource.',
        403
      );
    }

    if (!rbacService.userHasAnyPermission(access, keys)) {
      return apiResponse.error(
        res,
        'FORBIDDEN',
        'You do not have permission to access this resource.',
        403
      );
    }

    return next();
  };
}

module.exports = {
  requireAuthApi,
  requireAdminApi,
  requireStaffApi,
  requirePermission,
  requireAnyPermission,
};
