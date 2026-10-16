/**
 * Delivery/return fees, hotel delivery, catalog extras, late-return and fuel line items.
 * Delivery fees prefer admin config maps, then fall back to static DELIVERY_FEES constants.
 */

const { DELIVERY_FEES } = require('../../constants/locations');
const { round2 } = require('./pricingMath');

/**
 * Look up a location delivery fee from config map, else static DELIVERY_FEES.
 *
 * @param {object} config - Pricing config that may include `deliveryFeeMap`
 * @param {string} location - Location key (e.g. airport code / slug)
 * @returns {number} Fee in EUR, or 0 when location is empty / unknown
 * @throws {never}
 */
function feeFromConfig(config, location) {
  if (!location) return 0;
  // Admin-configured map overrides the static constants table.
  if (config?.deliveryFeeMap && config.deliveryFeeMap[location] != null) {
    return Number(config.deliveryFeeMap[location]) || 0;
  }
  // Fall back to compile-time DELIVERY_FEES from locations constants.
  return DELIVERY_FEES[location] ?? 0;
}

/**
 * Find an active global fee row by feeKey (hotel_delivery, late_return, fuel, …).
 *
 * @param {object} config - Pricing config with `globalFees`
 * @param {string} key - `feeKey` to match
 * @returns {object | undefined} Matching active fee, or undefined
 * @throws {never}
 */
function globalFee(config, key) {
  return (config.globalFees || []).find((f) => f.feeKey === key && f.active);
}

/**
 * Build delivery, return, hotel, and selected-extra price lines.
 *
 * @param {object} params
 * @param {object} params.cfg - Pricing config
 * @param {string} params.pickupLocation - Pickup location key
 * @param {string} params.returnLocation - Return location key
 * @param {boolean} params.hotelDelivery - Whether hotel delivery is selected
 * @param {number} params.rentalDays - Used for per_day modes
 * @param {string[]} params.codes - Normalized selected extra codes
 * @returns {{ deliveryPrice: number, returnPrice: number, lines: object[] }}
 * @throws {never}
 */
function applyDeliveryAndExtrasLines({
  cfg,
  pickupLocation,
  returnLocation,
  hotelDelivery,
  rentalDays,
  codes,
}) {
  const lines = [];

  // Delivery / return location fees (always evaluated; zero amounts omitted).
  const deliveryPrice = feeFromConfig(cfg, pickupLocation);
  const returnPrice = feeFromConfig(cfg, returnLocation);
  if (deliveryPrice) {
    lines.push({
      code: 'delivery_pickup',
      label: `Delivery (${pickupLocation})`,
      amount: deliveryPrice,
      type: 'fee',
    });
  }
  if (returnPrice) {
    lines.push({
      code: 'delivery_return',
      label: `Return (${returnLocation})`,
      amount: returnPrice,
      type: 'fee',
    });
  }

  // Hotel delivery global fee (flat or per_day × rentalDays).
  if (hotelDelivery) {
    const hotel = globalFee(cfg, 'hotel_delivery');
    if (hotel) {
      const amount =
        hotel.mode === 'per_day' ? round2(hotel.amount * rentalDays) : round2(hotel.amount);
      if (amount) {
        lines.push({
          code: 'hotel_delivery',
          label: hotel.label,
          amount,
          type: 'fee',
        });
      }
    }
  }

  // Selected extras from the active catalog (skip unknown / inactive codes).
  const catalog = cfg.extras || [];
  for (const code of codes) {
    const extra = catalog.find((e) => e.code === code && e.active);
    if (!extra) continue;
    const amount =
      extra.mode === 'per_day' ? round2(extra.amount * rentalDays) : round2(extra.amount);
    if (!amount) continue;
    lines.push({
      code: `extra_${extra.code}`,
      label: extra.label,
      amount,
      type: 'addon',
    });
  }

  return { deliveryPrice, returnPrice, lines };
}

/**
 * Optional late-return and fuel fee lines from global fee config.
 *
 * @param {object} params
 * @param {object} params.cfg - Pricing config
 * @param {boolean} params.lateReturn - Whether late-return fee was selected
 * @param {boolean} params.fuelFee - Whether fuel fee was selected
 * @param {number} params.rentalDays - Used when fee mode is per_day
 * @returns {{ lines: object[] }}
 * @throws {never}
 */
function applyLateAndFuelLines({ cfg, lateReturn, fuelFee, rentalDays }) {
  const lines = [];

  // Late-return fee when the customer opted in.
  if (lateReturn) {
    const late = globalFee(cfg, 'late_return');
    if (late) {
      const amount =
        late.mode === 'per_day' ? round2(late.amount * rentalDays) : round2(late.amount);
      if (amount) {
        lines.push({ code: 'late_return', label: late.label, amount, type: 'fee' });
      }
    }
  }

  // Fuel fee when the customer opted in.
  if (fuelFee) {
    const fuel = globalFee(cfg, 'fuel');
    if (fuel) {
      const amount =
        fuel.mode === 'per_day' ? round2(fuel.amount * rentalDays) : round2(fuel.amount);
      if (amount) {
        lines.push({ code: 'fuel', label: fuel.label, amount, type: 'fee' });
      }
    }
  }

  return { lines };
}

module.exports = {
  feeFromConfig,
  applyDeliveryAndExtrasLines,
  applyLateAndFuelLines,
};
