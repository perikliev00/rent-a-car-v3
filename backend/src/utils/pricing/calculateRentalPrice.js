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
 * Pricing engine.
 * Discounts apply to base + seasonal + weekend only (not delivery/extras).
 * Deposit is separate and not included in totalPrice.
 *
 * @param {object} car
 * @param {Date} start
 * @param {Date} end
 * @param {string} pickupLocation
 * @param {string} returnLocation
 * @param {object} [options]
 * @param {object} [config] pricing config (from DB or default)
 */
function computePrice(car, start, end, pickupLocation, returnLocation, options = {}, config) {
  const cfg = config || buildDefaultConfig();
  const {
    extras: selectedExtraCodes = [],
    hotelDelivery = false,
    lateReturn = false,
    fuelFee = false,
    bookedAt = new Date(),
  } = options;

  const codes = normalizeSelectedExtras(selectedExtraCodes);

  const rentalDays = computeRentalDaysSafe(start, end);
  const dayPrice = computeDayPrice(car, rentalDays);

  if (rentalDays <= 0) {
    return buildEmptyPriceResult();
  }

  const { baseAmount, line: baseLine } = buildBaseRentalLine({ dayPrice, rentalDays });

  const {
    seasonalAmount,
    weekendAmount,
    lines: adjustmentLines,
  } = applySeasonalAndWeekendAdjustments({ cfg, start, rentalDays, dayPrice });

  const rentalSubtotal = round2(baseAmount + seasonalAmount + weekendAmount);

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

  const { lines: discountLines } = applyDiscountLines({
    cfg,
    rentalSubtotal,
    rentalDays,
    start,
    bookedAt,
  });

  const { lines: lateFuelLines } = applyLateAndFuelLines({
    cfg,
    lateReturn,
    fuelFee,
    rentalDays,
  });

  const lines = [
    baseLine,
    ...adjustmentLines,
    ...deliveryExtrasLines,
    ...discountLines,
    ...lateFuelLines,
  ];

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
 */
function computeBookingPrice(car, start, end, pickupLocation, returnLocation, options = {}, config) {
  return computePrice(car, start, end, pickupLocation, returnLocation, options, config);
}

/**
 * Production path: load admin config from DB then compute.
 * Fails closed if pricing config cannot be loaded (no silent defaults).
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
