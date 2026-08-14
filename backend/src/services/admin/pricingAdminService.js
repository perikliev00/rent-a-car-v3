const pricingSql = require('../sql/pricingConfigSqlService');
const { computePrice } = require('../../utils/pricing/calculateRentalPrice');
const carRepository = require('../../repositories/carRepository');
const { validateBookingDates } = require('../../utils/bookingValidation');
const { ALLOWED_LOCATIONS } = require('../../constants/locations');

async function getPricingBundle() {
  return pricingSql.loadPricingConfig();
}

async function saveDeliveryFees(fees) {
  return pricingSql.upsertDeliveryFees(fees);
}

async function saveGlobalFee(feeKey, data) {
  return pricingSql.upsertGlobalFee(feeKey, data);
}

async function createSeason(data) {
  return pricingSql.createSeason(data);
}

async function updateSeason(id, data) {
  return pricingSql.updateSeason(id, data);
}

async function deleteSeason(id) {
  return pricingSql.deleteSeason(id);
}

async function saveWeekendRule(id, data) {
  return pricingSql.upsertWeekendRule(id, data);
}

async function updateDiscount(id, data) {
  return pricingSql.updateDiscountRule(id, data);
}

async function saveDeposit(id, data) {
  return pricingSql.upsertDepositRule(id, data);
}

async function createExtra(data) {
  return pricingSql.createExtra(data);
}

async function updateExtra(id, data) {
  return pricingSql.updateExtra(id, data);
}

async function deleteExtra(id) {
  return pricingSql.deleteExtra(id);
}

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

  if (!carId) {
    return { ok: false, status: 400, error: 'carId is required' };
  }
  if (!ALLOWED_LOCATIONS.includes(pickupLocation) || !ALLOWED_LOCATIONS.includes(returnLocation)) {
    return { ok: false, status: 400, error: 'Invalid pickup or return location' };
  }

  const car = await carRepository.findById(carId);
  if (!car) {
    return { ok: false, status: 404, error: 'Car not found' };
  }

  const { isValid, errors, startDate, endDate } = validateBookingDates({
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
  });

  if (!isValid || !startDate || !endDate) {
    return { ok: false, status: 422, error: errors?.[0] || 'Invalid booking dates' };
  }

  const config = await pricingSql.loadPricingConfig();
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
