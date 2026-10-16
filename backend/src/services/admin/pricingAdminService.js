/**
 * Admin pricing configuration facade: seasons, fees, extras, deposits, and
 * a dry-run preview that uses the same computePrice path as live bookings.
 */
const pricingSql = require('../sql/pricingConfigSqlService');
const { computePrice } = require('../../utils/pricing/calculateRentalPrice');
const carRepository = require('../../repositories/carRepository');
const { validateBookingDates } = require('../../utils/bookingValidation');
const { ALLOWED_LOCATIONS } = require('../../constants/locations');

/** Load the full pricing config bundle for the admin UI. */
async function getPricingBundle() {
  return pricingSql.loadPricingConfig();
}

/** @param {object} fees */
async function saveDeliveryFees(fees) {
  return pricingSql.upsertDeliveryFees(fees);
}

/** @param {string} feeKey @param {object} data */
async function saveGlobalFee(feeKey, data) {
  return pricingSql.upsertGlobalFee(feeKey, data);
}

/** @param {object} data */
async function createSeason(data) {
  return pricingSql.createSeason(data);
}

/** @param {number|string} id @param {object} data */
async function updateSeason(id, data) {
  return pricingSql.updateSeason(id, data);
}

/** @param {number|string} id */
async function deleteSeason(id) {
  return pricingSql.deleteSeason(id);
}

/** @param {number|string} id @param {object} data */
async function saveWeekendRule(id, data) {
  return pricingSql.upsertWeekendRule(id, data);
}

/** @param {number|string} id @param {object} data */
async function updateDiscount(id, data) {
  return pricingSql.updateDiscountRule(id, data);
}

/** @param {number|string} id @param {object} data */
async function saveDeposit(id, data) {
  return pricingSql.upsertDepositRule(id, data);
}

/** @param {object} data */
async function createExtra(data) {
  return pricingSql.createExtra(data);
}

/** @param {number|string} id @param {object} data */
async function updateExtra(id, data) {
  return pricingSql.updateExtra(id, data);
}

/** @param {number|string} id */
async function deleteExtra(id) {
  return pricingSql.deleteExtra(id);
}

/**
 * Preview rental price for admin tooling without creating a booking.
 * Returns { ok:false, status, error } shaped results for the controller.
 * @param {object} body
 */
async function previewPricing(body) {
  const {
    carId,
    pickupDate,
    returnDate,
    pickupTime = '10:00',
    returnTime = '10:00',
    pickupLocation,
    returnLocation,
    extras = [],
    hotelDelivery = false,
    lateReturn = false,
    fuelFee = false,
    bookedAt,
  } = body || {};

  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) {
    return { ok: false, status: 400, error: 'carId is required' };
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!ALLOWED_LOCATIONS.includes(pickupLocation) || !ALLOWED_LOCATIONS.includes(returnLocation)) {
    return { ok: false, status: 400, error: 'Invalid pickup or return location' };
  }

  const car = await carRepository.findById(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    return { ok: false, status: 404, error: 'Car not found' };
  }

  const { isValid, errors, startDate, endDate } = validateBookingDates({
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
  });

  // Guard: early-return or throw when required input is missing/invalid.
  if (!isValid || !startDate || !endDate) {
    return { ok: false, status: 422, error: errors?.[0] || 'Invalid booking dates' };
  }

  const config = await pricingSql.loadPricingConfig();
  // bookedAt lets admins simulate historical pricing rules for a quote date.
  const pricing = computePrice(
    car,
    startDate,
    endDate,
    pickupLocation,
    returnLocation,
    {
      extras,
      hotelDelivery: Boolean(hotelDelivery),
      lateReturn: Boolean(lateReturn),
      fuelFee: Boolean(fuelFee),
      bookedAt: bookedAt ? new Date(bookedAt) : new Date(),
    },
    config
  );

  return { ok: true, car: { id: car.id, name: car.name }, pricing };
}

module.exports = {
  getPricingBundle,
  saveDeliveryFees,
  saveGlobalFee,
  createSeason,
  updateSeason,
  deleteSeason,
  saveWeekendRule,
  updateDiscount,
  saveDeposit,
  createExtra,
  updateExtra,
  deleteExtra,
  previewPricing,
};
