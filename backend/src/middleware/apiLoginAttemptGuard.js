/**
 * Blocks login attempts for emails currently locked by the login-attempt service.
 * Mount before the login handler so locked accounts never hit password verification.
 */
const loginAttemptService = require('../services/auth/loginAttemptService');
const apiResponse = require('../utils/apiResponse');

/**
 * Return 429 when `req.body.email` is temporarily locked after failed logins.
 * Side effects: may write a 429 API error response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
function apiLoginAttemptGuard(req, res, next) {
  const email = req.body?.email;
  // Missing email → let validators / login handler respond with a normal error.
  if (!email || !loginAttemptService.isLocked(email)) {
    return next();
  }

  return apiResponse.error(
    res,
    'RATE_LIMITED',
    'Too many failed login attempts for this account. Please try again later.',
    429
  );
}

module.exports = { apiLoginAttemptGuard };
