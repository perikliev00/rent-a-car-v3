const apiResponse = require('../utils/apiResponse');
const apiKeyService = require('../services/apiKeyService');

/**
 * Optional API key auth.
 * - No x-api-key header: continue (anonymous / session).
 * - Invalid or revoked key: 401.
 * - Valid key: attach req.apiKey.
 */
async function optionalApiKeyAuth(req, res, next) {
  const rawKey = req.headers['x-api-key'];
  if (rawKey === undefined || rawKey === null || rawKey === '') {
    return next();
  }

  try {
    const apiKey = await apiKeyService.verifyApiKey(String(rawKey));
    if (!apiKey) {
      return apiResponse.error(res, 'UNAUTHORIZED', 'Invalid or revoked API key.', 401, req);
    }
    req.apiKey = apiKey;
    return next();
  } catch (err) {
    return next(err);
  }
}

function requireApiKeyScope(scope) {
  return function requireApiKeyScopeMiddleware(req, res, next) {
    if (!req.apiKey) {
      return next();
    }
    if (!apiKeyService.keyHasScope(req.apiKey, scope)) {
      return apiResponse.error(
        res,
        'FORBIDDEN',
        `API key is missing required scope: ${scope}`,
        403,
        req
      );
    }
    return next();
  };
}

module.exports = {
  optionalApiKeyAuth,
  requireApiKeyScope,
};
