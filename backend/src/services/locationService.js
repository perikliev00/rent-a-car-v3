/**
 * Pickup/return location helpers and delivery fee lookup.
 * Async fee map merges DB pricing config over static DELIVERY_FEES defaults.
 */
const {
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_LOCATIONS,
  // Contribute this line to the enclosing declaration or statement.
  LOCATION_LABELS,
  // Contribute this line to the enclosing declaration or statement.
  DELIVERY_FEES,
// Continue the surrounding logic with this statement.
} = require('../constants/locations');
// Destructure object properties into local variables.
const { loadPricingConfig } = require('./sql/pricingConfigSqlService');

/**
 * Whether location is in the allowed pickup/return set.
 * @param {string} location
 * @returns {boolean}
 */
function isValidLocation(location) {
  // Return the resulting value to the caller.
  return ALLOWED_LOCATIONS.includes(location);
}

/** Human-readable label for a location id (static labels or title-cased slug). */
function formatLocationName(location) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!location) return '';
  // Evaluate the condition and enter the branch when it is true.
  if (LOCATION_LABELS[location]) return LOCATION_LABELS[location];
  // Return the resulting value to the caller.
  return location
    // Call .split to perform this step.
    .split('-')
    // Call .map to perform this step.
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    // Call .join to perform this step.
    .join(' ');
}

/**
 * Options list for location dropdowns ({ id, label }).
 * @returns {Array<{ id: string, label: string }>}
 */
function getLocationOptions() {
  // Return the resulting value to the caller.
  return ALLOWED_LOCATIONS.map((id) => ({
    // Contribute this line to the enclosing declaration or statement.
    id,
    // Provide the label field value.
    label: LOCATION_LABELS[id] || formatLocationName(id),
  }));
}

/**
 * Sync delivery fee from static DELIVERY_FEES only (no DB).
 * @param {string} location
 * @returns {number}
 */
function feeFor(location) {
  // Return the resulting value to the caller.
  return DELIVERY_FEES[location] ?? 0;
}

/**
 * Delivery fees: static defaults overridden by pricing_config when available.
 * @returns {Promise<Record<string, number>>}
 */
async function getDeliveryFeeMap() {
  // Protected block: isolate failure modes.
  try {
    // DB fees override static defaults when pricing config loads.
    const config = await loadPricingConfig();
    // Return the resulting value to the caller.
    return { ...DELIVERY_FEES, ...config.deliveryFeeMap };
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Pricing DB unavailable — still price from constants.
    return { ...DELIVERY_FEES };
  }
}

/**
 * Delivery fee for a location using DB-aware fee map.
 * @param {string} location
 * @returns {Promise<number>}
 */
async function feeForAsync(location) {
  // Create the map constant.
  const map = await getDeliveryFeeMap();
  // Return the resulting value to the caller.
  return map[location] ?? 0;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_LOCATIONS,
  // Contribute this line to the enclosing declaration or statement.
  LOCATION_LABELS,
  // Contribute this line to the enclosing declaration or statement.
  DELIVERY_FEES,
  // Contribute this line to the enclosing declaration or statement.
  isValidLocation,
  // Contribute this line to the enclosing declaration or statement.
  formatLocationName,
  // Contribute this line to the enclosing declaration or statement.
  getLocationOptions,
  // Contribute this line to the enclosing declaration or statement.
  feeFor,
  // Contribute this line to the enclosing declaration or statement.
  feeForAsync,
  // Contribute this line to the enclosing declaration or statement.
  getDeliveryFeeMap,
};
