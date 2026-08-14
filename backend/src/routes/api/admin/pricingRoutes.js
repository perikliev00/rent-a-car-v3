const express = require('express');
const pricingController = require('../../../controllers/api/admin/pricingController');
const { requirePermission } = require('../../../middleware/auth');

const router = express.Router();
const canManagePricing = requirePermission('can_manage_pricing');

router.get('/', canManagePricing, pricingController.getPricing);
router.put('/delivery-fees', canManagePricing, pricingController.updateDeliveryFees);
router.put('/global-fees/:feeKey', canManagePricing, pricingController.updateGlobalFee);

router.post('/seasons', canManagePricing, pricingController.createSeason);
router.put('/seasons/:id', canManagePricing, pricingController.updateSeason);
router.delete('/seasons/:id', canManagePricing, pricingController.deleteSeason);

router.put('/weekend', canManagePricing, pricingController.updateWeekend);
router.put('/discounts/:id', canManagePricing, pricingController.updateDiscount);
router.put('/deposit', canManagePricing, pricingController.updateDeposit);

router.post('/extras', canManagePricing, pricingController.createExtra);
router.put('/extras/:id', canManagePricing, pricingController.updateExtra);
router.delete('/extras/:id', canManagePricing, pricingController.deleteExtra);

router.post('/preview', canManagePricing, pricingController.preview);

module.exports = router;
