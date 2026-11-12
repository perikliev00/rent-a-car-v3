/**
 * Double-submit CSRF helpers for cookie-session API clients.
 * Mutating methods must send `X-CSRF-Token` matching the session token;
 * API-key authenticated requests skip the check (machine clients).
 */
const crypto = require('crypto');
// Require the '../utils/apiResponse' module as apiResponse.
const apiResponse = require('../utils/apiResponse');

// Create the mutating methods constant.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Generate a new CSRF secret for the session.
 * @returns {string} Cryptographically random hex CSRF token
 */
function generateCsrfToken() {
  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return next();
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!req.session.csrfToken) {
    // Update req.session.csrfToken with the right-hand side value.
    req.session.csrfToken = generateCsrfToken();
  }

  // Return the resulting value to the caller.
  return next();
}

/**
 * Read the CSRF token currently stored on the session.
 * @param {import('express').Request} req
 * @returns {string|null} Session CSRF token, or null when absent
 */
function getCsrfToken(req) {
  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return next();
  }

  // Safe methods never change server state via this API.
  if (!MUTATING_METHODS.has(req.method)) {
    // Return the resulting value to the caller.
    return next();
  }

  // Create the session token constant.
  const sessionToken = getCsrfToken(req);
  // Create the header token constant.
  const headerToken = req.headers['x-csrf-token'];

  // Evaluate the condition and enter the branch when it is true.
  if (!sessionToken || !headerToken || headerToken !== sessionToken) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'CSRF_INVALID', 'Invalid or missing CSRF token.', 403);
  }

  // Return the resulting value to the caller.
  return next();
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ensureCsrfToken,
  // Contribute this line to the enclosing declaration or statement.
  requireCsrfToken,
  // Contribute this line to the enclosing declaration or statement.
  getCsrfToken,
  // Contribute this line to the enclosing declaration or statement.
  generateCsrfToken,
};
