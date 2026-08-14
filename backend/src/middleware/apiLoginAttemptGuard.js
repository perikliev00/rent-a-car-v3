const loginAttemptService = require('../services/auth/loginAttemptService');
const apiResponse = require('../utils/apiResponse');

function apiLoginAttemptGuard(req, res, next) {
  const email = req.body?.email;
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
