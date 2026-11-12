/**
 * Public metadata routes (locations, pricing info, categories) with optional meta:read scope.
 */
const express = require('express');
// Require the '../../controllers/api/metaController' module as metaController.
const metaController = require('../../controllers/api/metaController');
// Destructure object properties into local variables.
const { requireApiKeyScope } = require('../../middleware/apiKeyAuth');

// Create the router constant.
const router = express.Router();

// Pickup/dropoff location list for booking UI.
router.get('/locations', requireApiKeyScope('meta:read'), metaController.getLocations);
// Public pricing rules summary (fees, seasons hints).
router.get('/pricing-info', requireApiKeyScope('meta:read'), metaController.getPricingInfo);
// Car category catalog for filters.
router.get('/categories', requireApiKeyScope('meta:read'), metaController.getCategories);

// Assign the CommonJS module exports.
module.exports = router;
