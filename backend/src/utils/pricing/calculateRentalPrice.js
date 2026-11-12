/**
 * Pricing engine entry points: compose base, seasonal, delivery, discount, and fee lines.
 * Discounts apply to base + seasonal + weekend only (not delivery/extras).
 * Deposit is separate and not included in totalPrice.
 */

const { computeRentalDaysSafe } = require('../date/calculateRentalDays');
const {
  loadPricingConfig,
  buildDefaultConfig,
} = require('../../services/sql/pricingConfigSqlService');
const logger = require('../logger');
const { normalizeSelectedExtras } = require('./normalizeExtras');
const { round2 } = require('./pricingMath');
const { computeDayPrice, buildBaseRentalLine } = require('./baseDayPricing');
const {
  listChargeDates,
  applySeasonalAndWeekendAdjustments,
} = require('./seasonalWeekendAdjustments');
const { applyDiscountLines } = require('./discountPricing');
const {
  feeFromConfig,
  applyDeliveryAndExtrasLines,
  applyLateAndFuelLines,
} = require('./deliveryExtrasPricing');
const { resolveDeposit } = require('./depositPricing');
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
  const {
    extras: selectedExtraCodes = [],
    hotelDelivery = false,
    lateReturn = false,
    fuelFee = false,
    bookedAt = new Date(),
  } = options;

  // Collapse overlapping insurance selections before catalog lookup.
  const codes = normalizeSelectedExtras(selectedExtraCodes);

  // Safe day count: 0 when dates are missing/invalid (empty result below).
  const rentalDays = computeRentalDaysSafe(start, end);
  const dayPrice = computeDayPrice(car, rentalDays);

  if (rentalDays <= 0) {
    return buildEmptyPriceResult();
  }

  // Base rental line (dayPrice × rentalDays).
  const { baseAmount, line: baseLine } = buildBaseRentalLine({ dayPrice, rentalDays });

  // Seasonal + weekend surcharges on charge days.
  const {
    seasonalAmount,
    weekendAmount,
    lines: adjustmentLines,
  } = applySeasonalAndWeekendAdjustments({ cfg, start, rentalDays, dayPrice });

  // Discount base excludes delivery/extras/late/fuel.
  const rentalSubtotal = round2(baseAmount + seasonalAmount + weekendAmount);

  // Delivery, return, hotel, and catalog extras.
  const {
    deliveryPrice,
    returnPrice,
    lines: deliveryExtrasLines,
  } = applyDeliveryAndExtrasLines({
    cfg,
    pickupLocation,
    returnLocation,
    hotelDelivery,
    rentalDays,
    codes,
  });

  // Long / early / last-minute rules against rentalSubtotal only.
  const { lines: discountLines } = applyDiscountLines({
    cfg,
    rentalSubtotal,
    rentalDays,
    start,
    bookedAt,
  });

  // Optional late-return and fuel global fees.
  const { lines: lateFuelLines } = applyLateAndFuelLines({
    cfg,
    lateReturn,
    fuelFee,
    rentalDays,
  });

  // Stable line order for breakdown display and snapshot persistence.
  const lines = [
    baseLine,
    ...adjustmentLines,
    ...deliveryExtrasLines,
    ...discountLines,
    ...lateFuelLines,
  ];

  // Deposit is resolved but not summed into totalPrice.
  const deposit = resolveDeposit(cfg);

  return buildPriceResult({
    rentalDays,
    dayPrice,
    deliveryPrice,
    returnPrice,
    lines,
    deposit,
    pickupLocation,
    returnLocation,
    hotelDelivery,
    selectedExtras: codes,
    lateReturn,
    fuelFee,
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
  car,
  start,
  end,
  pickupLocation,
  returnLocation,
  options = {}
) {
  let config;
  try {
    // Load live admin pricing; do not fall back to defaults on failure.
    config = await loadPricingConfig();
  } catch (err) {
    logger.error({ err, context: 'computeBookingPriceAsync' }, 'Failed to load pricing config');
    throw err;
  }
  return computePrice(car, start, end, pickupLocation, returnLocation, options, config);
}

module.exports = {
  computeDayPrice,
  computePrice,
  computeBookingPrice,
  computeBookingPriceAsync,
  feeFromConfig,
  listChargeDates,
  normalizeSelectedExtras,
};
