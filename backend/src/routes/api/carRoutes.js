/**
 * Public car catalog routes (list, search, detail) with optional cars:read API-key scope.
 */
const express = require('express');
const carController = require('../../controllers/api/carController');
const { searchQueryValidationRules } = require('../../validators/searchQueryValidationRules');
const { carListQueryValidationRules } = require('../../validators/carListQueryValidationRules');
const { carIdParamValidation } = require('../../validators/carIdParamValidation');
const validateRequest = require('../../middleware/validateRequest');
const { requireApiKeyScope } = require('../../middleware/apiKeyAuth');
const { searchLimiter } = require('../../middleware/rateLimit');

const router = express.Router();

// Paginated / filtered catalog listing.
router.get(
  '/',
  requireApiKeyScope('cars:read'),
  carListQueryValidationRules,
  validateRequest,
  carController.getCars
);
// Availability search for a date range and filters.
router.get(
  '/search',
  searchLimiter,
  requireApiKeyScope('cars:read'),
  searchQueryValidationRules,
  validateRequest,
  carController.searchCars
);
// Single car detail by id.
router.get(
  '/:carId',
  requireApiKeyScope('cars:read'),
  carIdParamValidation,
  validateRequest,
  carController.getCarById
);

module.exports = router;
