/**
 * Pickup/return location helpers and delivery fee lookup.
 * Async fee map merges DB pricing config over static DELIVERY_FEES defaults.
 */
const {
  ALLOWED_LOCATIONS,
  LOCATION_LABELS,
  DELIVERY_FEES,
} = require('../constants/locations');
const { loadPricingConfig } = require('./sql/pricingConfigSqlService');

/**
 * Whether location is in the allowed pickup/return set.
 * @param {string} location
 * @returns {boolean}
 */
function isValidLocation(location) {
  return ALLOWED_LOCATIONS.includes(location);
}

/** Human-readable label for a location id (static labels or title-cased slug). */
function formatLocationName(location) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!location) return '';
  if (LOCATION_LABELS[location]) return LOCATION_LABELS[location];
  return location
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Options list for location dropdowns ({ id, label }).
 * @returns {Array<{ id: string, label: string }>}
 */
function getLocationOptions() {
  return ALLOWED_LOCATIONS.map((id) => ({
    id,
    label: LOCATION_LABELS[id] || formatLocationName(id),
  }));
}

/**
 * Sync delivery fee from static DELIVERY_FEES only (no DB).
 * @param {string} location
 * @returns {number}
 */
function feeFor(location) {
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
    return { ...DELIVERY_FEES, ...config.deliveryFeeMap };
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
  const map = await getDeliveryFeeMap();
  return map[location] ?? 0;
}

module.exports = {
  ALLOWED_LOCATIONS,
  LOCATION_LABELS,
  DELIVERY_FEES,
  isValidLocation,
  formatLocationName,
  getLocationOptions,
  feeFor,
  feeForAsync,
  getDeliveryFeeMap,
};
