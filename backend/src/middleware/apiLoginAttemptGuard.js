/**
 * Blocks login attempts for emails currently locked by the login-attempt service.
 * Mount before the login handler so locked accounts never hit password verification.
 */
const loginAttemptService = require('../services/auth/loginAttemptService');
// Require the '../utils/apiResponse' module as apiResponse.
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
  // Create the email constant.
  const email = req.body?.email;
  // Missing email → let validators / login handler respond with a normal error.
  if (!email || !loginAttemptService.isLocked(email)) {
    // Return the resulting value to the caller.
    return next();
  }

  // Return the resulting value to the caller.
  return apiResponse.error(
    // Contribute this line to the enclosing declaration or statement.
    res,
    // Supply the literal value used by the enclosing expression.
    'RATE_LIMITED',
    // Supply the literal value used by the enclosing expression.
    'Too many failed login attempts for this account. Please try again later.',
    // Supply the literal value used by the enclosing expression.
    429
  );
}

// Assign the CommonJS module exports.
module.exports = { apiLoginAttemptGuard };
