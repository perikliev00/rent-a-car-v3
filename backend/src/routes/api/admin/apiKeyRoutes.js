/**
 * Admin CRUD for machine API keys (list, create, revoke).
 */
const express = require('express');
// Require the '../../../controllers/api/admin/apiKeyController' module as apiKeyController.
const apiKeyController = require('../../../controllers/api/admin/apiKeyController');
// Destructure object properties into local variables.
const { requirePermission } = require('../../../middleware/auth');
// Destructure object properties into local variables.
const { body, param } = require('express-validator');
// Require the '../../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../../middleware/validateRequest');

// Create the router constant.
const router = express.Router();
// Create the can manage api keys constant.
const canManageApiKeys = requirePermission('can_manage_api_keys');

// List keys (secrets are never re-shown after create).
router.get('/', canManageApiKeys, apiKeyController.listApiKeys);

// Create a key; plaintext secret returned once in the response.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/',
  // Contribute this line to the enclosing declaration or statement.
  canManageApiKeys,
  [
    // Call body to perform this step.
    body('name').trim().notEmpty().withMessage('Name is required.'),
    // Call body to perform this step.
    body('scopes').optional().isArray().withMessage('Scopes must be an array.'),
    // Call body to perform this step.
    body('scopes.*').optional().isString().withMessage('Each scope must be a string.'),
    // Call body to perform this step.
    body('rateTier').optional().isString().withMessage('rateTier must be a string.'),
  ],
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  apiKeyController.createApiKey
);

// Soft-revoke so existing headers stop authenticating.
router.delete(
  // Supply the literal value used by the enclosing expression.
  '/:id',
  // Contribute this line to the enclosing declaration or statement.
  canManageApiKeys,
  // Continue the surrounding logic with this statement.
  [param('id').isInt({ min: 1 }).withMessage('Invalid API key id.')],
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  apiKeyController.revokeApiKey
);

// Assign the CommonJS module exports.
module.exports = router;
