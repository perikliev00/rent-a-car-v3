/**
 * Public metadata handlers: locations, pricing info, and categories.
 */
const {
  getLocationOptions,
  DELIVERY_FEES,
} = require('../../services/locationService');
const { listCategories } = require('../../services/sql/categorySqlService');
const { loadPricingConfig, buildDefaultConfig } = require('../../services/sql/pricingConfigSqlService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

/**
 * Load pricing config, returning a safe fallback on failure instead of throwing.
 * Side effects: may read pricing config from the database.
 * @returns {Promise<object>} Live config or `buildDefaultConfig()` fallback
 */
async function safePricingConfig() {
  try {
    return await loadPricingConfig();
  } catch {
    // Public meta endpoints should degrade gracefully if pricing tables are mid-migrate.
    return buildDefaultConfig();
  }
}

/**
 * Return pickup/drop-off locations and delivery/return fee maps.
 * Side effects: none beyond config/DB reads.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getLocations = asyncHandler(async (req, res, next) => {
  try {
    const config = await safePricingConfig();
    return apiResponse.success(res, {
      locations: getLocationOptions(),
      deliveryFees: config.deliveryFeeMap || DELIVERY_FEES,
      // Return fees currently mirror delivery fee map in the public API.
      returnFees: config.deliveryFeeMap || DELIVERY_FEES,
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getLocations',
      publicMessage: 'Error fetching locations.',
    });
  }
});

/**
 * Return public pricing info used by the SPA meta endpoints.
 * Side effects: none beyond config/DB reads; filters to active extras/fees only.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
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

/**
 * Return car categories for catalog filters.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
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
