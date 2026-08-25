const apiResponse = require('../utils/apiResponse');
const rbacService = require('../services/rbac/rbacService');

function requireAuthApi(req, res, next) {
  if (!req.session || !req.session.isLoggedIn || !req.session.user) {
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  return next();
}

/**
 * Fail-closed gate for historical account data.
 *
 * An authenticated but unverified session must not reach reservations, documents or PDFs,
 * because ownership of those records is what an email-based pre-hijack used to steal.
 * Staff and admin accounts are provisioned as verified, so this does not affect them.
 */
function requireVerifiedEmailApi(req, res, next) {
  if (!req.session || !req.session.isLoggedIn || !req.session.user) {
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  if (!req.session.user.emailVerified) {
    return apiResponse.error(
      res,
      'EMAIL_VERIFICATION_REQUIRED',
      'Confirm your email address to access your bookings.',
      403
    );
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
  if (!rbacService.isStaffAccess(access, req.session.user.role)) {
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
 * Legacy admin gate — now means staff access (any assigned role / permissions).
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
    if (!rbacService.isStaffAccess(access, req.session.user.role)) {
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
    if (!rbacService.isStaffAccess(access, req.session.user.role)) {
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
  requireVerifiedEmailApi,
  requireAdminApi,
  requireStaffApi,
  requirePermission,
  requireAnyPermission,
};
