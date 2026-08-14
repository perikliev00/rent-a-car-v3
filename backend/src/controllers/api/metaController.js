const {
  getLocationOptions,
  DELIVERY_FEES,
} = require('../../services/locationService');
const { listCategories } = require('../../services/sql/categorySqlService');
const { loadPricingConfig, buildDefaultConfig } = require('../../services/sql/pricingConfigSqlService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

async function safePricingConfig() {
  try {
    return await loadPricingConfig();
  } catch {
    return buildDefaultConfig();
  }
}

exports.getLocations = asyncHandler(async (req, res, next) => {
  try {
    const config = await safePricingConfig();
    return apiResponse.success(res, {
      locations: getLocationOptions(),
      deliveryFees: config.deliveryFeeMap || DELIVERY_FEES,
      returnFees: config.deliveryFeeMap || DELIVERY_FEES,
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getLocations',
      publicMessage: 'Error fetching locations.',
    });
  }
});

exports.getPricingInfo = asyncHandler(async (req, res, next) => {
  try {
    const config = await safePricingConfig();
    return apiResponse.success(res, {
      deliveryFees: config.deliveryFeeMap || DELIVERY_FEES,
      returnFees: config.deliveryFeeMap || DELIVERY_FEES,
      extras: (config.extras || []).filter((e) => e.active),
      deposit: (config.depositRules || []).find((d) => d.active)?.defaultAmount ?? 0,
      globalFees: (config.globalFees || []).filter((f) => f.active),
      priceTierExplanation: {
        tier1_3: '1-3 days',
        tier7_31: '7-31 days',
        tier31_plus: '31+ days',
      },
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getPricingInfo',
      publicMessage: 'Error fetching pricing info.',
    });
  }
});

exports.getCategories = asyncHandler(async (req, res, next) => {
  try {
    const categories = await listCategories();
    return apiResponse.success(res, { categories });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getCategories',
      publicMessage: 'Error fetching categories.',
    });
  }
});
