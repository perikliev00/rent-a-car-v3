/**
 * Admin API key list/create/revoke handlers.
 */
const apiKeyService = require('../../../services/apiKeyService');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');

/**
 * List API keys (secrets redacted).
 * Side effects: none beyond DB read.
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response>}
 */
const listApiKeys = asyncHandler(async (_req, res) => {
  // Create the api keys constant.
  const apiKeys = await apiKeyService.listApiKeys();
  // Return the resulting value to the caller.
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
  // Destructure object properties into local variables.
  const { name, scopes, rateTier } = req.body || {};
  // Create the created by user id constant.
  const createdByUserId = req.session?.user?.id || null;
  // Create the result constant.
  const result = await apiKeyService.createApiKey({
    // Contribute this line to the enclosing declaration or statement.
    name,
    // Contribute this line to the enclosing declaration or statement.
    scopes,
    // Contribute this line to the enclosing declaration or statement.
    rateTier,
    // Contribute this line to the enclosing declaration or statement.
    createdByUserId,
  });
  // Return the resulting value to the caller.
  return apiResponse.success(
    // Contribute this line to the enclosing declaration or statement.
    res,
    {
      // Provide the api key field value.
      apiKey: result.apiKey,
      // Provide the raw key field value.
      rawKey: result.rawKey,
    },
    // Supply the literal value used by the enclosing expression.
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
  // Create the api key constant.
  const apiKey = await apiKeyService.revokeApiKey(req.params.id);
  // Return the resulting value to the caller.
  return apiResponse.success(res, { apiKey });
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listApiKeys,
  // Contribute this line to the enclosing declaration or statement.
  createApiKey,
  // Contribute this line to the enclosing declaration or statement.
  revokeApiKey,
};
