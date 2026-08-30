const carRepository = require('../../../repositories/carRepository');
const carSql = require('../../sql/carSqlService');
const storage = require('../../storage');
const { ConflictError } = require('../../../utils/appError');
const { CAR_STATUSES } = require('../../../constants/carEnums');
const { buildCarPayload } = require('./carAdminPayload');
const { deleteManagedImageIfUnused } = require('./carAdminHelpers');
const {
  syncInsuranceInspectionCompliance,
  reconcileFleetAlertsQuietly,
} = require('./carAdminComplianceService');

async function listCars() {
  return carRepository.listAll();
}

async function getCarById(id) {
  return carRepository.findByIdForAdmin(id);
}

async function createCar(payload, file) {
  const carPayload = buildCarPayload(payload, file);
  const car = await carRepository.create(carPayload);
  await syncInsuranceInspectionCompliance(car.id, carPayload, null);
  return carRepository.findByIdForAdmin(car.id);
}

function extractPriceTiers(car) {
  return {
    priceTier_1_3: car?.priceTier_1_3 ?? null,
    priceTier_7_31: car?.priceTier_7_31 ?? null,
    priceTier_31_plus: car?.priceTier_31_plus ?? null,
  };
}

function priceTiersChanged(previousTiers, nextTiers) {
  return (
    Number(previousTiers.priceTier_1_3) !== Number(nextTiers.priceTier_1_3) ||
    Number(previousTiers.priceTier_7_31) !== Number(nextTiers.priceTier_7_31) ||
    Number(previousTiers.priceTier_31_plus) !== Number(nextTiers.priceTier_31_plus)
  );
}

async function updateCar(id, payload, file) {
  const existingCar = await carRepository.findByIdForAdmin(id);
  if (!existingCar) {
    throw new Error('Car not found');
  }

  const previousImage = existingCar.image;
  const previousTiers = extractPriceTiers(existingCar);
  const carPayload = buildCarPayload(payload, file, existingCar);
  const newTiers = extractPriceTiers(carPayload);
  const updated = await carRepository.update(id, carPayload);
  if (!updated) {
    throw new Error('Car not found');
  }

  await syncInsuranceInspectionCompliance(id, carPayload, null);
  await reconcileFleetAlertsQuietly();

  if (
    file &&
    previousImage &&
    previousImage !== carPayload.image &&
    storage.isManagedPublicUrl(previousImage)
  ) {
    await deleteManagedImageIfUnused(previousImage);
  }

  const refreshed = await carRepository.findByIdForAdmin(id);

  return {
    car: refreshed || updated,
    audit: {
      priceChanged: priceTiersChanged(previousTiers, newTiers),
      previousTiers,
      newTiers,
      name: refreshed?.name ?? updated?.name ?? carPayload.name,
    },
  };
}

async function deleteCar(id) {
  const existingCar = await carRepository.findByIdForAdmin(id);
  if (!existingCar) {
    throw new Error('Car not found');
  }

  const activeBookings = await carSql.countActiveFleetReservations(id);
  if (activeBookings > 0) {
    throw new ConflictError('Cannot delete car with active bookings', {
      activeBookings,
    });
  }

  const deleted = await carRepository.deleteById(id);
  if (!deleted) {
    throw new Error('Car not found');
  }

  if (existingCar.image && storage.isManagedPublicUrl(existingCar.image)) {
    await deleteManagedImageIfUnused(existingCar.image);
  }
}

async function changeFleetStatus(id, status, reason = null) {
  if (!CAR_STATUSES.includes(status)) {
    const err = new Error('Invalid car status');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const existing = await carRepository.findByIdForAdmin(id);
  if (!existing || existing.isDeleted) {
    throw new Error('Car not found');
  }

  const car = await carSql.updateCarStatus(id, status);
  return { car, oldStatus: existing.status, newStatus: status, reason };
}

module.exports = {
  listCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  changeFleetStatus,
};
