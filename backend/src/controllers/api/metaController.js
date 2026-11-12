/**
 * Public metadata handlers: locations, pricing info, and categories.
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  getLocationOptions,
  // Contribute this line to the enclosing declaration or statement.
  DELIVERY_FEES,
// Continue the surrounding logic with this statement.
} = require('../../services/locationService');
// Destructure object properties into local variables.
const { listCategories } = require('../../services/sql/categorySqlService');
// Destructure object properties into local variables.
const { loadPricingConfig, buildDefaultConfig } = require('../../services/sql/pricingConfigSqlService');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');

/**
 * Load pricing config, returning a safe fallback on failure instead of throwing.
 * Side effects: may read pricing config from the database.
 * @returns {Promise<object>} Live config or `buildDefaultConfig()` fallback
 */
async function safePricingConfig() {
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return await loadPricingConfig();
  // Contribute this line to the enclosing declaration or statement.
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
  // Start a try block for operations that may fail.
  try {
    // Create the config constant.
    const config = await safePricingConfig();
    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the locations field value.
      locations: getLocationOptions(),
      // Provide the delivery fees field value.
      deliveryFees: config.deliveryFeeMap || DELIVERY_FEES,
      // Return fees currently mirror delivery fee map in the public API.
      returnFees: config.deliveryFeeMap || DELIVERY_FEES,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getLocations',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the config constant.
    const config = await safePricingConfig();
    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the delivery fees field value.
      deliveryFees: config.deliveryFeeMap || DELIVERY_FEES,
      // Provide the return fees field value.
      returnFees: config.deliveryFeeMap || DELIVERY_FEES,
      // Provide the extras field value.
      extras: (config.extras || []).filter((e) => e.active),
      // Provide the deposit field value.
      deposit: (config.depositRules || []).find((d) => d.active)?.defaultAmount ?? 0,
      // Provide the global fees field value.
      globalFees: (config.globalFees || []).filter((f) => f.active),
      // Provide the price tier explanation field value.
      priceTierExplanation: {
        // Provide the tier1 3 field value.
        tier1_3: '1-3 days',
        // Provide the tier7 31 field value.
        tier7_31: '7-31 days',
        // Provide the tier31 plus field value.
        tier31_plus: '31+ days',
      },
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getPricingInfo',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the categories constant.
    const categories = await listCategories();
    // Return the resulting value to the caller.
    return apiResponse.success(res, { categories });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getCategories',
      // Provide the public message field value.
      publicMessage: 'Error fetching categories.',
    });
  }
});
