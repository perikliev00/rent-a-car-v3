/**
 * Delivery/return fees, hotel delivery, catalog extras, late-return and fuel line items.
 * Delivery fees prefer admin config maps, then fall back to static DELIVERY_FEES constants.
 */

const { DELIVERY_FEES } = require('../../constants/locations');
// Destructure object properties into local variables.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!location) return 0;
  // Admin-configured map overrides the static constants table.
  if (config?.deliveryFeeMap && config.deliveryFeeMap[location] != null) {
    // Return the resulting value to the caller.
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
  // Return the resulting value to the caller.
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
// Continue the surrounding logic with this statement.
}) {
  // Create the lines constant.
  const lines = [];

  // Delivery / return location fees (always evaluated; zero amounts omitted).
  const deliveryPrice = feeFromConfig(cfg, pickupLocation);
  // Create the return price constant.
  const returnPrice = feeFromConfig(cfg, returnLocation);
  // Evaluate the condition and enter the branch when it is true.
  if (deliveryPrice) {
    // Call lines.push to perform this step.
    lines.push({
      // Provide the code field value.
      code: 'delivery_pickup',
      // Provide the label field value.
      label: `Delivery (${pickupLocation})`,
      // Provide the amount field value.
      amount: deliveryPrice,
      // Provide the type field value.
      type: 'fee',
    });
  }
  // Evaluate the condition and enter the branch when it is true.
  if (returnPrice) {
    // Call lines.push to perform this step.
    lines.push({
      // Provide the code field value.
      code: 'delivery_return',
      // Provide the label field value.
      label: `Return (${returnLocation})`,
      // Provide the amount field value.
      amount: returnPrice,
      // Provide the type field value.
      type: 'fee',
    });
  }

  // Hotel delivery global fee (flat or per_day × rentalDays).
  if (hotelDelivery) {
    // Create the hotel constant.
    const hotel = globalFee(cfg, 'hotel_delivery');
    // Evaluate the condition and enter the branch when it is true.
    if (hotel) {
      // Create the amount constant.
      const amount =
        // Update hotel.mode with the right-hand side value.
        hotel.mode === 'per_day' ? round2(hotel.amount * rentalDays) : round2(hotel.amount);
      // Evaluate the condition and enter the branch when it is true.
      if (amount) {
        // Call lines.push to perform this step.
        lines.push({
          // Provide the code field value.
          code: 'hotel_delivery',
          // Provide the label field value.
          label: hotel.label,
          // Contribute this line to the enclosing declaration or statement.
          amount,
          // Provide the type field value.
          type: 'fee',
        });
      }
    }
  }

  // Selected extras from the active catalog (skip unknown / inactive codes).
  const catalog = cfg.extras || [];
  // Iterate using the loop initializer, condition, and step.
  for (const code of codes) {
    // Create the extra constant.
    const extra = catalog.find((e) => e.code === code && e.active);
    // Evaluate the condition and enter the branch when it is true.
    if (!extra) continue;
    // Create the amount constant.
    const amount =
      // Update extra.mode with the right-hand side value.
      extra.mode === 'per_day' ? round2(extra.amount * rentalDays) : round2(extra.amount);
    // Evaluate the condition and enter the branch when it is true.
    if (!amount) continue;
    // Call lines.push to perform this step.
    lines.push({
      // Provide the code field value.
      code: `extra_${extra.code}`,
      // Provide the label field value.
      label: extra.label,
      // Contribute this line to the enclosing declaration or statement.
      amount,
      // Provide the type field value.
      type: 'addon',
    });
  }

  // Return the resulting value to the caller.
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
  // Create the lines constant.
  const lines = [];

  // Late-return fee when the customer opted in.
  if (lateReturn) {
    // Create the late constant.
    const late = globalFee(cfg, 'late_return');
    // Evaluate the condition and enter the branch when it is true.
    if (late) {
      // Create the amount constant.
      const amount =
        // Update late.mode with the right-hand side value.
        late.mode === 'per_day' ? round2(late.amount * rentalDays) : round2(late.amount);
      // Evaluate the condition and enter the branch when it is true.
      if (amount) {
        // Call lines.push to perform this step.
        lines.push({ code: 'late_return', label: late.label, amount, type: 'fee' });
      }
    }
  }

  // Fuel fee when the customer opted in.
  if (fuelFee) {
    // Create the fuel constant.
    const fuel = globalFee(cfg, 'fuel');
    // Evaluate the condition and enter the branch when it is true.
    if (fuel) {
      // Create the amount constant.
      const amount =
        // Update fuel.mode with the right-hand side value.
        fuel.mode === 'per_day' ? round2(fuel.amount * rentalDays) : round2(fuel.amount);
      // Evaluate the condition and enter the branch when it is true.
      if (amount) {
        // Call lines.push to perform this step.
        lines.push({ code: 'fuel', label: fuel.label, amount, type: 'fee' });
      }
    }
  }

  // Return the resulting value to the caller.
  return { lines };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  feeFromConfig,
  // Contribute this line to the enclosing declaration or statement.
  applyDeliveryAndExtrasLines,
  // Contribute this line to the enclosing declaration or statement.
  applyLateAndFuelLines,
};
