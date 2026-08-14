const express = require('express');
const metaController = require('../../controllers/api/metaController');
const { requireApiKeyScope } = require('../../middleware/apiKeyAuth');

const router = express.Router();

router.get('/locations', requireApiKeyScope('meta:read'), metaController.getLocations);
router.get('/pricing-info', requireApiKeyScope('meta:read'), metaController.getPricingInfo);
router.get('/categories', requireApiKeyScope('meta:read'), metaController.getCategories);

module.exports = router;
