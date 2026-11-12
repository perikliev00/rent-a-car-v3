/**
 * Admin pricing configuration (seasons, fees, extras, deposits, preview).
 */
const express = require('express');
// Require the '../../../controllers/api/admin/pricingController' module as pricingController.
const pricingController = require('../../../controllers/api/admin/pricingController');
// Destructure object properties into local variables.
const { requirePermission } = require('../../../middleware/auth');

// Create the router constant.
const router = express.Router();
// Create the can manage pricing constant.
const canManagePricing = requirePermission('can_manage_pricing');

// Full pricing settings snapshot for the admin UI.
router.get('/', canManagePricing, pricingController.getPricing);
// Delivery fee table by location/distance bands.
router.put('/delivery-fees', canManagePricing, pricingController.updateDeliveryFees);
// One global fee key (e.g. young-driver, airport).
router.put('/global-fees/:feeKey', canManagePricing, pricingController.updateGlobalFee);

// Seasonal rate windows CRUD.
router.post('/seasons', canManagePricing, pricingController.createSeason);
// Call router.put to perform this step.
router.put('/seasons/:id', canManagePricing, pricingController.updateSeason);
// Call router.delete to perform this step.
router.delete('/seasons/:id', canManagePricing, pricingController.deleteSeason);

// Weekend multiplier / flat adjustments.
router.put('/weekend', canManagePricing, pricingController.updateWeekend);
// Length-of-rental discount tiers.
router.put('/discounts/:id', canManagePricing, pricingController.updateDiscount);
// Security deposit defaults.
router.put('/deposit', canManagePricing, pricingController.updateDeposit);

// Optional extras catalog CRUD.
router.post('/extras', canManagePricing, pricingController.createExtra);
// Call router.put to perform this step.
router.put('/extras/:id', canManagePricing, pricingController.updateExtra);
// Call router.delete to perform this step.
router.delete('/extras/:id', canManagePricing, pricingController.deleteExtra);

// Dry-run price breakdown for admin preview tool.
router.post('/preview', canManagePricing, pricingController.preview);

// Assign the CommonJS module exports.
module.exports = router;
