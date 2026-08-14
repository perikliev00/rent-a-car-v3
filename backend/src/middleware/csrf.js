const crypto = require('crypto');
const apiResponse = require('../utils/apiResponse');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

function ensureCsrfToken(req, _res, next) {
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  return next();
}

function getCsrfToken(req) {
  return req.session?.csrfToken || null;
}

function requireCsrfToken(req, res, next) {
  // API-key authenticated requests skip CSRF (machine clients; no session cookie flow)
  if (req.apiKey) {
    return next();
  }

  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  const sessionToken = getCsrfToken(req);
  const headerToken = req.headers['x-csrf-token'];

  if (!sessionToken || !headerToken || headerToken !== sessionToken) {
    return apiResponse.error(res, 'CSRF_INVALID', 'Invalid or missing CSRF token.', 403);
  }

  return next();
}

module.exports = {
  ensureCsrfToken,
  requireCsrfToken,
  getCsrfToken,
  generateCsrfToken,
};
