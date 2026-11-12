/**
 * Public car catalog routes (list, search, detail) with optional cars:read API-key scope.
 */
const express = require('express');
// Require the '../../controllers/api/carController' module as carController.
const carController = require('../../controllers/api/carController');
// Destructure object properties into local variables.
const { searchQueryValidationRules } = require('../../validators/searchQueryValidationRules');
// Destructure object properties into local variables.
const { carListQueryValidationRules } = require('../../validators/carListQueryValidationRules');
// Destructure object properties into local variables.
const { carIdParamValidation } = require('../../validators/carIdParamValidation');
// Require the '../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../middleware/validateRequest');
// Destructure object properties into local variables.
const { requireApiKeyScope } = require('../../middleware/apiKeyAuth');
// Destructure object properties into local variables.
const { searchLimiter } = require('../../middleware/rateLimit');

// Create the router constant.
const router = express.Router();

// Paginated / filtered catalog listing.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/',
  // Call requireApiKeyScope to perform this step.
  requireApiKeyScope('cars:read'),
  // Contribute this line to the enclosing declaration or statement.
  carListQueryValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.getCars
);
// Availability search for a date range and filters.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/search',
  // Contribute this line to the enclosing declaration or statement.
  searchLimiter,
  // Call requireApiKeyScope to perform this step.
  requireApiKeyScope('cars:read'),
  // Contribute this line to the enclosing declaration or statement.
  searchQueryValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.searchCars
);
// Single car detail by id.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:carId',
  // Call requireApiKeyScope to perform this step.
  requireApiKeyScope('cars:read'),
  // Contribute this line to the enclosing declaration or statement.
  carIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  carController.getCarById
);

// Assign the CommonJS module exports.
module.exports = router;
