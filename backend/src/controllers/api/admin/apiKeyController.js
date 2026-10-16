/**
 * Admin API key list/create/revoke handlers.
 */
const apiKeyService = require('../../../services/apiKeyService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');

/**
 * List API keys (secrets redacted).
 * Side effects: none beyond DB read.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
const listApiKeys = asyncHandler(async (_req, res) => {
  const apiKeys = await apiKeyService.listApiKeys();
  return apiResponse.success(res, { apiKeys });
});

/**
 * Create an API key and return the raw secret once.
 * Side effects: inserts a hashed key row; response includes plaintext `rawKey` only here.
 * @param {import('express').Request} req - Body: name, scopes?, rateTier?
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
const createApiKey = asyncHandler(async (req, res) => {
  const { name, scopes, rateTier } = req.body || {};
  const createdByUserId = req.session?.user?.id || null;
  const result = await apiKeyService.createApiKey({
    name,
    scopes,
    rateTier,
    createdByUserId,
  });
  return apiResponse.success(
    res,
    {
      apiKey: result.apiKey,
      rawKey: result.rawKey,
    },
    201
  );
});

/**
 * Revoke an API key by id so subsequent headers fail verification.
 * Side effects: marks the key revoked in the database.
 * @param {import('express').Request} req - Params: id
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
const revokeApiKey = asyncHandler(async (req, res) => {
  const apiKey = await apiKeyService.revokeApiKey(req.params.id);
  return apiResponse.success(res, { apiKey });
});

module.exports = {
  listApiKeys,
  createApiKey,
  revokeApiKey,
};
