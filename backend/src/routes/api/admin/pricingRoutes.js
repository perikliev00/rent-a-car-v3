/**
 * Admin pricing configuration (seasons, fees, extras, deposits, preview).
 */
const express = require('express');
const pricingController = require('../../../controllers/api/admin/pricingController');
const { requirePermission } = require('../../../middleware/auth');

const router = express.Router();
const canManagePricing = requirePermission('can_manage_pricing');

// Full pricing settings snapshot for the admin UI.
router.get('/', canManagePricing, pricingController.getPricing);
// Delivery fee table by location/distance bands.
router.put('/delivery-fees', canManagePricing, pricingController.updateDeliveryFees);
// One global fee key (e.g. young-driver, airport).
router.put('/global-fees/:feeKey', canManagePricing, pricingController.updateGlobalFee);

// Seasonal rate windows CRUD.
router.post('/seasons', canManagePricing, pricingController.createSeason);
router.put('/seasons/:id', canManagePricing, pricingController.updateSeason);
router.delete('/seasons/:id', canManagePricing, pricingController.deleteSeason);

// Weekend multiplier / flat adjustments.
router.put('/weekend', canManagePricing, pricingController.updateWeekend);
// Length-of-rental discount tiers.
router.put('/discounts/:id', canManagePricing, pricingController.updateDiscount);
// Security deposit defaults.
router.put('/deposit', canManagePricing, pricingController.updateDeposit);

// Optional extras catalog CRUD.
router.post('/extras', canManagePricing, pricingController.createExtra);
router.put('/extras/:id', canManagePricing, pricingController.updateExtra);
router.delete('/extras/:id', canManagePricing, pricingController.deleteExtra);

// Dry-run price breakdown for admin preview tool.
router.post('/preview', canManagePricing, pricingController.preview);

module.exports = router;
