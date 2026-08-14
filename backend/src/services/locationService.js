const {
  ALLOWED_LOCATIONS,
  LOCATION_LABELS,
  DELIVERY_FEES,
} = require('../constants/locations');
const { loadPricingConfig } = require('./sql/pricingConfigSqlService');

function isValidLocation(location) {
  return ALLOWED_LOCATIONS.includes(location);
}

function formatLocationName(location) {
  if (!location) return '';
  if (LOCATION_LABELS[location]) return LOCATION_LABELS[location];
  return location
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getLocationOptions() {
  return ALLOWED_LOCATIONS.map((id) => ({
    id,
    label: LOCATION_LABELS[id] || formatLocationName(id),
  }));
}

function feeFor(location) {
  return DELIVERY_FEES[location] ?? 0;
}

async function getDeliveryFeeMap() {
  try {
    const config = await loadPricingConfig();
    return { ...DELIVERY_FEES, ...config.deliveryFeeMap };
  } catch {
    return { ...DELIVERY_FEES };
  }
}

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
