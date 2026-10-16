/**
 * Admin car CRUD: create/update/soft-delete fleet vehicles and change fleet status.
 * Create/update also sync insurance/inspection compliance rows used by fleet alerts.
 */
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

/** List all cars for admin (includes inactive/non-deleted). */
async function listCars() {
  return carRepository.listAll();
}

/** @param {number|string} id */
async function getCarById(id) {
  return carRepository.findByIdForAdmin(id);
}

/**
 * Create a car and upsert insurance/inspection compliance from form expiry fields.
 * @param {object} payload
 * @param {object|null} file
 */
async function createCar(payload, file) {
  const carPayload = buildCarPayload(payload, file);
  const car = await carRepository.create(carPayload);
  await syncInsuranceInspectionCompliance(car.id, carPayload, null);
  return carRepository.findByIdForAdmin(car.id);
}

/**
 * extract price tiers.
 * @param {*} car
 * @returns {*}
 */
function extractPriceTiers(car) {
  return {
    priceTier_1_3: car?.priceTier_1_3 ?? null,
    priceTier_7_31: car?.priceTier_7_31 ?? null,
    priceTier_31_plus: car?.priceTier_31_plus ?? null,
  };
}

/**
 * price tiers changed.
 * @param {*} previousTiers
 * @param {*} nextTiers
 * @returns {*}
 */
function priceTiersChanged(previousTiers, nextTiers) {
  return (
    Number(previousTiers.priceTier_1_3) !== Number(nextTiers.priceTier_1_3) ||
    Number(previousTiers.priceTier_7_31) !== Number(nextTiers.priceTier_7_31) ||
    Number(previousTiers.priceTier_31_plus) !== Number(nextTiers.priceTier_31_plus)
  );
}

/**
 * Update car; sync compliance, reconcile alerts, and delete replaced managed images.
 * Returns audit metadata about price-tier changes for admin logging.
 * @param {number|string} id
 * @param {object} payload
 * @param {object|null} file
 */
async function updateCar(id, payload, file) {
  const existingCar = await carRepository.findByIdForAdmin(id);
  // Idempotency guard: return early when work was already applied.
  if (!existingCar) {
    throw new Error('Car not found');
  }

  const previousImage = existingCar.image;
  const previousTiers = extractPriceTiers(existingCar);
  const carPayload = buildCarPayload(payload, file, existingCar);
  const newTiers = extractPriceTiers(carPayload);
  const updated = await carRepository.update(id, carPayload);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!updated) {
    throw new Error('Car not found');
  }

  await syncInsuranceInspectionCompliance(id, carPayload, null);
  await reconcileFleetAlertsQuietly();

  // Only delete the old image after a successful replace with a new upload.
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

/**
 * Soft-delete a car only when no active fleet reservations remain.
 * @param {number|string} id
 */
async function deleteCar(id) {
  const existingCar = await carRepository.findByIdForAdmin(id);
  // Idempotency guard: return early when work was already applied.
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
  // Guard: early-return or throw when required input is missing/invalid.
  if (!deleted) {
    throw new Error('Car not found');
  }

  // Idempotency guard: return early when work was already applied.
  if (existingCar.image && storage.isManagedPublicUrl(existingCar.image)) {
    await deleteManagedImageIfUnused(existingCar.image);
  }
}

/**
 * Manually set fleet status (admin override of lifecycle sync).
 * @param {number|string} id
 * @param {string} status
 * @param {string|null} [reason]
 */
async function changeFleetStatus(id, status, reason = null) {
  // Status / lifecycle guard before mutating domain state.
  if (!CAR_STATUSES.includes(status)) {
    const err = new Error('Invalid car status');
    err.code = 'VALIDATION_ERROR';
    throw err;
  }

  const existing = await carRepository.findByIdForAdmin(id);
  // Idempotency guard: return early when work was already applied.
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
