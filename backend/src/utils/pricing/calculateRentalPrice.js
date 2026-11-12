/**
 * Pricing engine entry points: compose base, seasonal, delivery, discount, and fee lines.
 * Discounts apply to base + seasonal + weekend only (not delivery/extras).
 * Deposit is separate and not included in totalPrice.
 */

const { computeRentalDaysSafe } = require('../date/calculateRentalDays');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  loadPricingConfig,
  // Contribute this line to the enclosing declaration or statement.
  buildDefaultConfig,
// Continue the surrounding logic with this statement.
} = require('../../services/sql/pricingConfigSqlService');
// Require the '../logger' module as logger.
const logger = require('../logger');
// Destructure object properties into local variables.
const { normalizeSelectedExtras } = require('./normalizeExtras');
// Destructure object properties into local variables.
const { round2 } = require('./pricingMath');
// Destructure object properties into local variables.
const { computeDayPrice, buildBaseRentalLine } = require('./baseDayPricing');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  listChargeDates,
  // Contribute this line to the enclosing declaration or statement.
  applySeasonalAndWeekendAdjustments,
// Continue the surrounding logic with this statement.
} = require('./seasonalWeekendAdjustments');
// Destructure object properties into local variables.
const { applyDiscountLines } = require('./discountPricing');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  feeFromConfig,
  // Contribute this line to the enclosing declaration or statement.
  applyDeliveryAndExtrasLines,
  // Contribute this line to the enclosing declaration or statement.
  applyLateAndFuelLines,
// Continue the surrounding logic with this statement.
} = require('./deliveryExtrasPricing');
// Destructure object properties into local variables.
const { resolveDeposit } = require('./depositPricing');
// Destructure object properties into local variables.
const { buildEmptyPriceResult, buildPriceResult } = require('./priceBreakdownBuilder');

/**
 * Core pricing computation given an already-resolved config.
 * Pipeline: days → day rate → base → seasonal/weekend → delivery/extras → discounts → late/fuel → deposit → totals.
 *
 * @param {object} car - Car with price / tier fields
 * @param {Date} start - Rental start
 * @param {Date} end - Rental end
 * @param {string} pickupLocation - Pickup location key
 * @param {string} returnLocation - Return location key
 * @param {object} [options] - Booking options (extras, hotelDelivery, lateReturn, fuelFee, bookedAt)
 * @param {string[]} [options.extras] - Selected extra codes
 * @param {boolean} [options.hotelDelivery=false]
 * @param {boolean} [options.lateReturn=false]
 * @param {boolean} [options.fuelFee=false]
 * @param {Date} [options.bookedAt] - Defaults to now
 * @param {object} [config] - Pricing config (from DB or default)
 * @returns {object} Pricing result from {@link buildPriceResult} or {@link buildEmptyPriceResult}
 * @throws {never}
 */
function computePrice(car, start, end, pickupLocation, returnLocation, options = {}, config) {
  // Prefer caller-supplied config; otherwise use in-memory defaults (not DB).
  const cfg = config || buildDefaultConfig();
  // Destructure object properties into local variables.
  const {
    // Provide the extras field value.
    extras: selectedExtraCodes = [],
    // Update hotelDelivery with the right-hand side value.
    hotelDelivery = false,
    // Update lateReturn with the right-hand side value.
    lateReturn = false,
    // Update fuelFee with the right-hand side value.
    fuelFee = false,
    // Update bookedAt with the right-hand side value.
    bookedAt = new Date(),
  // Continue the surrounding logic with this statement.
  } = options;

  // Collapse overlapping insurance selections before catalog lookup.
  const codes = normalizeSelectedExtras(selectedExtraCodes);

  // Safe day count: 0 when dates are missing/invalid (empty result below).
  const rentalDays = computeRentalDaysSafe(start, end);
  // Create the day price constant.
  const dayPrice = computeDayPrice(car, rentalDays);

  // Evaluate the condition and enter the branch when it is true.
  if (rentalDays <= 0) {
    // Return the resulting value to the caller.
    return buildEmptyPriceResult();
  }

  // Base rental line (dayPrice × rentalDays).
  const { baseAmount, line: baseLine } = buildBaseRentalLine({ dayPrice, rentalDays });

  // Seasonal + weekend surcharges on charge days.
  const {
    // Contribute this line to the enclosing declaration or statement.
    seasonalAmount,
    // Contribute this line to the enclosing declaration or statement.
    weekendAmount,
    // Provide the lines field value.
    lines: adjustmentLines,
  // Continue the surrounding logic with this statement.
  } = applySeasonalAndWeekendAdjustments({ cfg, start, rentalDays, dayPrice });

  // Discount base excludes delivery/extras/late/fuel.
  const rentalSubtotal = round2(baseAmount + seasonalAmount + weekendAmount);

  // Delivery, return, hotel, and catalog extras.
  const {
    // Contribute this line to the enclosing declaration or statement.
    deliveryPrice,
    // Contribute this line to the enclosing declaration or statement.
    returnPrice,
    // Provide the lines field value.
    lines: deliveryExtrasLines,
  // Continue the surrounding logic with this statement.
  } = applyDeliveryAndExtrasLines({
    // Contribute this line to the enclosing declaration or statement.
    cfg,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Contribute this line to the enclosing declaration or statement.
    hotelDelivery,
    // Contribute this line to the enclosing declaration or statement.
    rentalDays,
    // Contribute this line to the enclosing declaration or statement.
    codes,
  });

  // Long / early / last-minute rules against rentalSubtotal only.
  const { lines: discountLines } = applyDiscountLines({
    // Contribute this line to the enclosing declaration or statement.
    cfg,
    // Contribute this line to the enclosing declaration or statement.
    rentalSubtotal,
    // Contribute this line to the enclosing declaration or statement.
    rentalDays,
    // Contribute this line to the enclosing declaration or statement.
    start,
    // Contribute this line to the enclosing declaration or statement.
    bookedAt,
  });

  // Optional late-return and fuel global fees.
  const { lines: lateFuelLines } = applyLateAndFuelLines({
    // Contribute this line to the enclosing declaration or statement.
    cfg,
    // Contribute this line to the enclosing declaration or statement.
    lateReturn,
    // Contribute this line to the enclosing declaration or statement.
    fuelFee,
    // Contribute this line to the enclosing declaration or statement.
    rentalDays,
  });

  // Stable line order for breakdown display and snapshot persistence.
  const lines = [
    // Contribute this line to the enclosing declaration or statement.
    baseLine,
    // Spread adjustmentLines into the surrounding structure.
    ...adjustmentLines,
    // Spread deliveryExtrasLines into the surrounding structure.
    ...deliveryExtrasLines,
    // Spread discountLines into the surrounding structure.
    ...discountLines,
    // Spread lateFuelLines into the surrounding structure.
    ...lateFuelLines,
  ];

  // Deposit is resolved but not summed into totalPrice.
  const deposit = resolveDeposit(cfg);

  // Return the resulting value to the caller.
  return buildPriceResult({
    // Contribute this line to the enclosing declaration or statement.
    rentalDays,
    // Contribute this line to the enclosing declaration or statement.
    dayPrice,
    // Contribute this line to the enclosing declaration or statement.
    deliveryPrice,
    // Contribute this line to the enclosing declaration or statement.
    returnPrice,
    // Contribute this line to the enclosing declaration or statement.
    lines,
    // Contribute this line to the enclosing declaration or statement.
    deposit,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Contribute this line to the enclosing declaration or statement.
    hotelDelivery,
    // Provide the selected extras field value.
    selectedExtras: codes,
    // Contribute this line to the enclosing declaration or statement.
    lateReturn,
    // Contribute this line to the enclosing declaration or statement.
    fuelFee,
    // Contribute this line to the enclosing declaration or statement.
    bookedAt,
  });
}

/**
 * Sync helper used by tests / simple callers with optional config.
 * Without config uses buildDefaultConfig (constants for delivery fees).
 *
 * @param {object} car
 * @param {Date} start
 * @param {Date} end
 * @param {string} pickupLocation
 * @param {string} returnLocation
 * @param {object} [options]
 * @param {object} [config]
 * @returns {object}
 * @throws {never}
 */
function computeBookingPrice(car, start, end, pickupLocation, returnLocation, options = {}, config) {
  // Return the resulting value to the caller.
  return computePrice(car, start, end, pickupLocation, returnLocation, options, config);
}

/**
 * Production path: load admin config from DB then compute.
 * Fails closed if pricing config cannot be loaded (no silent defaults).
 *
 * @param {object} car
 * @param {Date} start
 * @param {Date} end
 * @param {string} pickupLocation
 * @param {string} returnLocation
 * @param {object} [options]
 * @returns {Promise<object>}
 * @throws {Error} When `loadPricingConfig` fails (logged then rethrown)
 */
async function computeBookingPriceAsync(
  // Contribute this line to the enclosing declaration or statement.
  car,
  // Contribute this line to the enclosing declaration or statement.
  start,
  // Contribute this line to the enclosing declaration or statement.
  end,
  // Contribute this line to the enclosing declaration or statement.
  pickupLocation,
  // Contribute this line to the enclosing declaration or statement.
  returnLocation,
  // Update options with the right-hand side value.
  options = {}
// Continue the surrounding logic with this statement.
) {
  // Reserve the config variable for later assignment.
  let config;
  // Start a try block for operations that may fail.
  try {
    // Load live admin pricing; do not fall back to defaults on failure.
    config = await loadPricingConfig();
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, context: 'computeBookingPriceAsync' }, 'Failed to load pricing config');
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Return the resulting value to the caller.
  return computePrice(car, start, end, pickupLocation, returnLocation, options, config);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  computeDayPrice,
  // Contribute this line to the enclosing declaration or statement.
  computePrice,
  // Contribute this line to the enclosing declaration or statement.
  computeBookingPrice,
  // Contribute this line to the enclosing declaration or statement.
  computeBookingPriceAsync,
  // Contribute this line to the enclosing declaration or statement.
  feeFromConfig,
  // Contribute this line to the enclosing declaration or statement.
  listChargeDates,
  // Contribute this line to the enclosing declaration or statement.
  normalizeSelectedExtras,
};
