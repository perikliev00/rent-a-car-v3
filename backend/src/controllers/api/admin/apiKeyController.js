const apiKeyService = require('../../../services/apiKeyService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');

const listApiKeys = asyncHandler(async (_req, res) => {
  const apiKeys = await apiKeyService.listApiKeys();
  return apiResponse.success(res, { apiKeys });
});

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

const revokeApiKey = asyncHandler(async (req, res) => {
  const apiKey = await apiKeyService.revokeApiKey(req.params.id);
  return apiResponse.success(res, { apiKey });
});

module.exports = {
  listApiKeys,
  createApiKey,
  revokeApiKey,
};
