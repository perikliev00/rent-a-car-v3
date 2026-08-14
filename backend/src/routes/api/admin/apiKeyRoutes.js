const express = require('express');
const apiKeyController = require('../../../controllers/api/admin/apiKeyController');
const { requirePermission } = require('../../../middleware/auth');
const { body, param } = require('express-validator');
const validateRequest = require('../../../middleware/validateRequest');

const router = express.Router();
const canManageApiKeys = requirePermission('can_manage_api_keys');

router.get('/', canManageApiKeys, apiKeyController.listApiKeys);

router.post(
  '/',
  canManageApiKeys,
  [
    body('name').trim().notEmpty().withMessage('Name is required.'),
    body('scopes').optional().isArray().withMessage('Scopes must be an array.'),
    body('scopes.*').optional().isString().withMessage('Each scope must be a string.'),
    body('rateTier').optional().isString().withMessage('rateTier must be a string.'),
  ],
  validateRequest,
  apiKeyController.createApiKey
);

router.delete(
  '/:id',
  canManageApiKeys,
  [param('id').isInt({ min: 1 }).withMessage('Invalid API key id.')],
  validateRequest,
  apiKeyController.revokeApiKey
);

module.exports = router;
