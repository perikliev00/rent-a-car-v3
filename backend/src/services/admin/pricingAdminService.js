/**
 * Admin pricing configuration facade: seasons, fees, extras, deposits, and
 * a dry-run preview that uses the same computePrice path as live bookings.
 */
const pricingSql = require('../sql/pricingConfigSqlService');
// Destructure object properties into local variables.
const { computePrice } = require('../../utils/pricing/calculateRentalPrice');
// Require the '../../repositories/carRepository' module as carRepository.
const carRepository = require('../../repositories/carRepository');
// Destructure object properties into local variables.
const { validateBookingDates } = require('../../utils/bookingValidation');
// Destructure object properties into local variables.
const { ALLOWED_LOCATIONS } = require('../../constants/locations');

/** Load the full pricing config bundle for the admin UI. */
async function getPricingBundle() {
  // Return the resulting value to the caller.
  return pricingSql.loadPricingConfig();
}

/** @param {object} fees */
async function saveDeliveryFees(fees) {
  // Return the resulting value to the caller.
  return pricingSql.upsertDeliveryFees(fees);
}

/** @param {string} feeKey @param {object} data */
async function saveGlobalFee(feeKey, data) {
  // Return the resulting value to the caller.
  return pricingSql.upsertGlobalFee(feeKey, data);
}

/** @param {object} data */
async function createSeason(data) {
  // Return the resulting value to the caller.
  return pricingSql.createSeason(data);
}

/** @param {number|string} id @param {object} data */
async function updateSeason(id, data) {
  // Return the resulting value to the caller.
  return pricingSql.updateSeason(id, data);
}

/** @param {number|string} id */
async function deleteSeason(id) {
  // Return the resulting value to the caller.
  return pricingSql.deleteSeason(id);
}

/** @param {number|string} id @param {object} data */
async function saveWeekendRule(id, data) {
  // Return the resulting value to the caller.
  return pricingSql.upsertWeekendRule(id, data);
}

/** @param {number|string} id @param {object} data */
async function updateDiscount(id, data) {
  // Return the resulting value to the caller.
  return pricingSql.updateDiscountRule(id, data);
}

/** @param {number|string} id @param {object} data */
async function saveDeposit(id, data) {
  // Return the resulting value to the caller.
  return pricingSql.upsertDepositRule(id, data);
}

/** @param {object} data */
async function createExtra(data) {
  // Return the resulting value to the caller.
  return pricingSql.createExtra(data);
}

/** @param {number|string} id @param {object} data */
async function updateExtra(id, data) {
  // Return the resulting value to the caller.
  return pricingSql.updateExtra(id, data);
}

/** @param {number|string} id */
async function deleteExtra(id) {
  // Return the resulting value to the caller.
  return pricingSql.deleteExtra(id);
}

/**
 * Preview rental price for admin tooling without creating a booking.
 * Returns { ok:false, status, error } shaped results for the controller.
 * @param {object} body
 */
async function previewPricing(body) {
  // Destructure object properties into local variables.
  const {
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    pickupDate,
    // Contribute this line to the enclosing declaration or statement.
    returnDate,
    // Update pickupTime with the right-hand side value.
    pickupTime = '10:00',
    // Update returnTime with the right-hand side value.
    returnTime = '10:00',
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Update extras with the right-hand side value.
    extras = [],
    // Update hotelDelivery with the right-hand side value.
    hotelDelivery = false,
    // Update lateReturn with the right-hand side value.
    lateReturn = false,
    // Update fuelFee with the right-hand side value.
    fuelFee = false,
    // Contribute this line to the enclosing declaration or statement.
    bookedAt,
  // Continue the surrounding logic with this statement.
  } = body || {};

  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId) {
    // Return the resulting value to the caller.
    return { ok: false, status: 400, error: 'carId is required' };
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!ALLOWED_LOCATIONS.includes(pickupLocation) || !ALLOWED_LOCATIONS.includes(returnLocation)) {
    // Return the resulting value to the caller.
    return { ok: false, status: 400, error: 'Invalid pickup or return location' };
  }

  // Create the car constant.
  const car = await carRepository.findById(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car) {
    // Return the resulting value to the caller.
    return { ok: false, status: 404, error: 'Car not found' };
  }

  // Destructure object properties into local variables.
  const { isValid, errors, startDate, endDate } = validateBookingDates({
    // Contribute this line to the enclosing declaration or statement.
    pickupDate,
    // Contribute this line to the enclosing declaration or statement.
    returnDate,
    // Contribute this line to the enclosing declaration or statement.
    pickupTime,
    // Contribute this line to the enclosing declaration or statement.
    returnTime,
  });

  // Guard: early-return or throw when required input is missing/invalid.
  if (!isValid || !startDate || !endDate) {
    // Return the resulting value to the caller.
    return { ok: false, status: 422, error: errors?.[0] || 'Invalid booking dates' };
  }

  // Create the config constant.
  const config = await pricingSql.loadPricingConfig();
  // bookedAt lets admins simulate historical pricing rules for a quote date.
  const pricing = computePrice(
    // Contribute this line to the enclosing declaration or statement.
    car,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    {
      // Contribute this line to the enclosing declaration or statement.
      extras,
      // Provide the hotel delivery field value.
      hotelDelivery: Boolean(hotelDelivery),
      // Provide the late return field value.
      lateReturn: Boolean(lateReturn),
      // Provide the fuel fee field value.
      fuelFee: Boolean(fuelFee),
      // Provide the booked at field value.
      bookedAt: bookedAt ? new Date(bookedAt) : new Date(),
    },
    // Reference the identifier used by the enclosing expression.
    config
  );

  // Return the resulting value to the caller.
  return { ok: true, car: { id: car.id, name: car.name }, pricing };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getPricingBundle,
  // Contribute this line to the enclosing declaration or statement.
  saveDeliveryFees,
  // Contribute this line to the enclosing declaration or statement.
  saveGlobalFee,
  // Contribute this line to the enclosing declaration or statement.
  createSeason,
  // Contribute this line to the enclosing declaration or statement.
  updateSeason,
  // Contribute this line to the enclosing declaration or statement.
  deleteSeason,
  // Contribute this line to the enclosing declaration or statement.
  saveWeekendRule,
  // Contribute this line to the enclosing declaration or statement.
  updateDiscount,
  // Contribute this line to the enclosing declaration or statement.
  saveDeposit,
  // Contribute this line to the enclosing declaration or statement.
  createExtra,
  // Contribute this line to the enclosing declaration or statement.
  updateExtra,
  // Contribute this line to the enclosing declaration or statement.
  deleteExtra,
  // Contribute this line to the enclosing declaration or statement.
  previewPricing,
};
