/**
 * Double-submit CSRF helpers for cookie-session API clients.
 * Mutating methods must send `X-CSRF-Token` matching the session token;
 * API-key authenticated requests skip the check (machine clients).
 */
const crypto = require('crypto');
const apiResponse = require('../utils/apiResponse');

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Generate a new CSRF secret for the session.
 * @returns {string} Cryptographically random hex CSRF token
 */
function generateCsrfToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Ensure the session has a CSRF token (creates one if missing).
 * Side effects: may mutate `req.session.csrfToken`.
 * @param {import('express').Request} req
 * @param {import('express').Response} _res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function ensureCsrfToken(req, _res, next) {
  // No session middleware yet — nothing to store; continue.
  if (!req.session) {
    return next();
  }

  if (!req.session.csrfToken) {
    req.session.csrfToken = generateCsrfToken();
  }

  return next();
}

/**
 * Read the CSRF token currently stored on the session.
 * @param {import('express').Request} req
 * @returns {string|null} Session CSRF token, or null when absent
 */
function getCsrfToken(req) {
  return req.session?.csrfToken || null;
}

/**
 * Reject mutating requests with missing/mismatched CSRF header (unless API key auth).
 * Side effects: may write a 403 API error response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void|import('express').Response}
 */
function requireCsrfToken(req, res, next) {
  // API-key authenticated requests skip CSRF (machine clients; no session cookie flow)
  if (req.apiKey) {
    return next();
  }

  // Safe methods never change server state via this API.
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
