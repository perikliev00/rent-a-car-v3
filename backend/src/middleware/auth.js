/**
 * Session-based API auth and RBAC permission gates for Express handlers.
 * All gates read `req.session.user` populated by the login/auth controllers.
 */
const apiResponse = require('../utils/apiResponse');
const rbacService = require('../services/rbac/rbacService');

/**
 * Require an authenticated session user (`isLoggedIn` + `user` present).
 * Side effects: may write a 401 API error response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
function requireAuthApi(req, res, next) {
  if (!req.session || !req.session.isLoggedIn || !req.session.user) {
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  return next();
}

/**
 * Normalize roles/permissions arrays from the session user for RBAC checks.
 * Missing arrays become empty lists so RBAC helpers never see undefined.
 * @param {import('express').Request} req
 * @returns {{ roles: string[], permissions: string[] }}
 */
function sessionAccess(req) {
  const user = req.session?.user || {};
  return {
    roles: Array.isArray(user.roles) ? user.roles : [],
    permissions: Array.isArray(user.permissions) ? user.permissions : [],
  };
}

/**
 * Require a logged-in staff user (any staff RBAC access).
 * Side effects: may write 401/403 API error responses.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
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
 * Side effects: delegates to `requireStaffApi` (may write 401/403).
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
function requireAdminApi(req, res, next) {
  return requireStaffApi(req, res, next);
}

/**
 * Factory: require staff access plus a specific permission key.
 * @param {string} permissionKey - RBAC permission string (e.g. `cars.write`)
 * @returns {import('express').RequestHandler} Middleware that may respond 401/403
 */
function requirePermission(permissionKey) {
  return function requirePermissionMiddleware(req, res, next) {
    if (!req.session || !req.session.isLoggedIn || !req.session.user) {
      return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
    }

    const access = sessionAccess(req);
    // Must be staff before fine-grained permission checks.
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

/**
 * Factory: require staff access plus at least one of the given permission keys.
 * @param {string|string[]} permissionKeys - One key or a list of acceptable keys
 * @returns {import('express').RequestHandler} Middleware that may respond 401/403
 */
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
