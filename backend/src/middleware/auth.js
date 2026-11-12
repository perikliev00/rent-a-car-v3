/**
 * Session-based API auth and RBAC permission gates for Express handlers.
 * All gates read `req.session.user` populated by the login/auth controllers.
 */
const apiResponse = require('../utils/apiResponse');
// Require the '../services/rbac/rbacService' module as rbacService.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!req.session || !req.session.isLoggedIn || !req.session.user) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  // Return the resulting value to the caller.
  return next();
}

/**
 * Normalize roles/permissions arrays from the session user for RBAC checks.
 * Missing arrays become empty lists so RBAC helpers never see undefined.
 * @param {import('express').Request} req
 * @returns {{ roles: string[], permissions: string[] }}
 */
function sessionAccess(req) {
  // Create the user constant.
  const user = req.session?.user || {};
  // Return the resulting value to the caller.
  return {
    // Provide the roles field value.
    roles: Array.isArray(user.roles) ? user.roles : [],
    // Provide the permissions field value.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!req.session || !req.session.isLoggedIn || !req.session.user) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
  }

  // Create the access constant.
  const access = sessionAccess(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!rbacService.isStaffAccess(access)) {
    // Return the resulting value to the caller.
    return apiResponse.error(
      // Contribute this line to the enclosing declaration or statement.
      res,
      // Supply the literal value used by the enclosing expression.
      'FORBIDDEN',
      // Supply the literal value used by the enclosing expression.
      'You do not have permission to access this resource.',
      // Supply the literal value used by the enclosing expression.
      403
    );
  }

  // Return the resulting value to the caller.
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
  // Return the resulting value to the caller.
  return requireStaffApi(req, res, next);
}

/**
 * Factory: require staff access plus a specific permission key.
 * @param {string} permissionKey - RBAC permission string (e.g. `cars.write`)
 * @returns {import('express').RequestHandler} Middleware that may respond 401/403
 */
function requirePermission(permissionKey) {
  // Return the resulting value to the caller.
  return function requirePermissionMiddleware(req, res, next) {
    // Evaluate the condition and enter the branch when it is true.
    if (!req.session || !req.session.isLoggedIn || !req.session.user) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
    }

    // Create the access constant.
    const access = sessionAccess(req);
    // Must be staff before fine-grained permission checks.
    if (!rbacService.isStaffAccess(access)) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'FORBIDDEN',
        // Supply the literal value used by the enclosing expression.
        'You do not have permission to access this resource.',
        // Supply the literal value used by the enclosing expression.
        403
      );
    }

    // Evaluate the condition and enter the branch when it is true.
    if (!rbacService.userHasPermission(access, permissionKey)) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'FORBIDDEN',
        // Supply the literal value used by the enclosing expression.
        'You do not have permission to access this resource.',
        // Supply the literal value used by the enclosing expression.
        403
      );
    }

    // Return the resulting value to the caller.
    return next();
  };
}

/**
 * Factory: require staff access plus at least one of the given permission keys.
 * @param {string|string[]} permissionKeys - One key or a list of acceptable keys
 * @returns {import('express').RequestHandler} Middleware that may respond 401/403
 */
function requireAnyPermission(permissionKeys) {
  // Create the keys constant.
  const keys = Array.isArray(permissionKeys) ? permissionKeys : [permissionKeys];
  // Return the resulting value to the caller.
  return function requireAnyPermissionMiddleware(req, res, next) {
    // Evaluate the condition and enter the branch when it is true.
    if (!req.session || !req.session.isLoggedIn || !req.session.user) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'UNAUTHORIZED', 'You are not logged in.', 401);
    }

    // Create the access constant.
    const access = sessionAccess(req);
    // Evaluate the condition and enter the branch when it is true.
    if (!rbacService.isStaffAccess(access)) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'FORBIDDEN',
        // Supply the literal value used by the enclosing expression.
        'You do not have permission to access this resource.',
        // Supply the literal value used by the enclosing expression.
        403
      );
    }

    // Evaluate the condition and enter the branch when it is true.
    if (!rbacService.userHasAnyPermission(access, keys)) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'FORBIDDEN',
        // Supply the literal value used by the enclosing expression.
        'You do not have permission to access this resource.',
        // Supply the literal value used by the enclosing expression.
        403
      );
    }

    // Return the resulting value to the caller.
    return next();
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  requireAuthApi,
  // Contribute this line to the enclosing declaration or statement.
  requireAdminApi,
  // Contribute this line to the enclosing declaration or statement.
  requireStaffApi,
  // Contribute this line to the enclosing declaration or statement.
  requirePermission,
  // Contribute this line to the enclosing declaration or statement.
  requireAnyPermission,
};
