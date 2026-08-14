const express = require('express');
const carController = require('../../controllers/api/carController');
const { searchQueryValidationRules } = require('../../validators/searchQueryValidationRules');
const { carListQueryValidationRules } = require('../../validators/carListQueryValidationRules');
const { carIdParamValidation } = require('../../validators/carIdParamValidation');
const validateRequest = require('../../middleware/validateRequest');
const { requireApiKeyScope } = require('../../middleware/apiKeyAuth');

const router = express.Router();

router.get(
  '/',
  requireApiKeyScope('cars:read'),
  carListQueryValidationRules,
  validateRequest,
  carController.getCars
);
router.get(
  '/search',
  requireApiKeyScope('cars:read'),
  searchQueryValidationRules,
  validateRequest,
  carController.searchCars
);
router.get(
  '/:carId',
  requireApiKeyScope('cars:read'),
  carIdParamValidation,
  validateRequest,
  carController.getCarById
);

module.exports = router;
