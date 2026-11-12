/**
 * Optional `x-api-key` authentication and scope checks for machine clients.
 * Mounted early on `/api` so CSRF can skip when `req.apiKey` is set.
 */
const apiResponse = require('../utils/apiResponse');
// Require the '../services/apiKeyService' module as apiKeyService.
const apiKeyService = require('../services/apiKeyService');

/**
 * Optional API key auth.
 * - No x-api-key header: continue (anonymous / session).
 * - Invalid or revoked key: 401.
 * - Valid key: attach req.apiKey.
 * Side effects: may set `req.apiKey` or write a 401 response; DB lookup on verify.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void|import('express').Response>}
 */
async function optionalApiKeyAuth(req, res, next) {
  // Create the raw key constant.
  const rawKey = req.headers['x-api-key'];
  // Absent header → treat as browser/session client.
  if (rawKey === undefined || rawKey === null || rawKey === '') {
    // Return the resulting value to the caller.
    return next();
  }

  // Start a try block for operations that may fail.
  try {
    // Create the api key constant.
    const apiKey = await apiKeyService.verifyApiKey(String(rawKey));
    // Evaluate the condition and enter the branch when it is true.
    if (!apiKey) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'UNAUTHORIZED', 'Invalid or revoked API key.', 401, req);
    }
    // Update req.apiKey with the right-hand side value.
    req.apiKey = apiKey;
    // Return the resulting value to the caller.
    return next();
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return next(err);
  }
}

/**
 * When `req.apiKey` is present, require the given scope; session-only requests pass through.
 * @param {string} scope - Required API key scope string
 * @returns {import('express').RequestHandler} Middleware that may respond 403
 */
function requireApiKeyScope(scope) {
  // Return the resulting value to the caller.
  return function requireApiKeyScopeMiddleware(req, res, next) {
    // No API key on the request → session auth alone is fine.
    if (!req.apiKey) {
      // Return the resulting value to the caller.
      return next();
    }
    // Evaluate the condition and enter the branch when it is true.
    if (!apiKeyService.keyHasScope(req.apiKey, scope)) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'FORBIDDEN',
        // Continue the surrounding logic with this statement.
        `API key is missing required scope: ${scope}`,
        // Supply the literal value used by the enclosing expression.
        403,
        // Reference the identifier used by the enclosing expression.
        req
      );
    }
    // Return the resulting value to the caller.
    return next();
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  optionalApiKeyAuth,
  // Contribute this line to the enclosing declaration or statement.
  requireApiKeyScope,
};
