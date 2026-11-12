/**
 * Admin car CRUD: create/update/soft-delete fleet vehicles and change fleet status.
 * Create/update also sync insurance/inspection compliance rows used by fleet alerts.
 */
const carRepository = require('../../../repositories/carRepository');
// Require the '../../sql/carSqlService' module as carSql.
const carSql = require('../../sql/carSqlService');
// Require the '../../storage' module as storage.
const storage = require('../../storage');
// Destructure object properties into local variables.
const { ConflictError } = require('../../../utils/appError');
// Destructure object properties into local variables.
const { CAR_STATUSES } = require('../../../constants/carEnums');
// Destructure object properties into local variables.
const { buildCarPayload } = require('./carAdminPayload');
// Destructure object properties into local variables.
const { deleteManagedImageIfUnused } = require('./carAdminHelpers');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  syncInsuranceInspectionCompliance,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlertsQuietly,
// Continue the surrounding logic with this statement.
} = require('./carAdminComplianceService');

/** List all cars for admin (includes inactive/non-deleted). */
async function listCars() {
  // Return the resulting value to the caller.
  return carRepository.listAll();
}

/** @param {number|string} id */
async function getCarById(id) {
  // Return the resulting value to the caller.
  return carRepository.findByIdForAdmin(id);
}

/**
 * Create a car and upsert insurance/inspection compliance from form expiry fields.
 * @param {object} payload
 * @param {object|null} file
 */
async function createCar(payload, file) {
  // Create the car payload constant.
  const carPayload = buildCarPayload(payload, file);
  // Create the car constant.
  const car = await carRepository.create(carPayload);
  // Wait until the asynchronous operation resolves.
  await syncInsuranceInspectionCompliance(car.id, carPayload, null);
  // Return the resulting value to the caller.
  return carRepository.findByIdForAdmin(car.id);
}

/**
 * extract price tiers.
 * @param {*} car
 * @returns {*}
 */
function extractPriceTiers(car) {
  // Return the resulting value to the caller.
  return {
    // Provide the price tier 1 3 field value.
    priceTier_1_3: car?.priceTier_1_3 ?? null,
    // Provide the price tier 7 31 field value.
    priceTier_7_31: car?.priceTier_7_31 ?? null,
    // Provide the price tier 31 plus field value.
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
  // Return control to the caller with the following value.
  return (
    // Call Number to perform this step.
    Number(previousTiers.priceTier_1_3) !== Number(nextTiers.priceTier_1_3) ||
    // Call Number to perform this step.
    Number(previousTiers.priceTier_7_31) !== Number(nextTiers.priceTier_7_31) ||
    // Call Number to perform this step.
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
  // Create the existing car constant.
  const existingCar = await carRepository.findByIdForAdmin(id);
  // Idempotency guard: return early when work was already applied.
  if (!existingCar) {
    // Throw an error to stop the current control flow.
    throw new Error('Car not found');
  }

  // Create the previous image constant.
  const previousImage = existingCar.image;
  // Create the previous tiers constant.
  const previousTiers = extractPriceTiers(existingCar);
  // Create the car payload constant.
  const carPayload = buildCarPayload(payload, file, existingCar);
  // Create the new tiers constant.
  const newTiers = extractPriceTiers(carPayload);
  // Create the updated constant.
  const updated = await carRepository.update(id, carPayload);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!updated) {
    // Throw an error to stop the current control flow.
    throw new Error('Car not found');
  }

  // Wait until the asynchronous operation resolves.
  await syncInsuranceInspectionCompliance(id, carPayload, null);
  // Wait until the asynchronous operation resolves.
  await reconcileFleetAlertsQuietly();

  // Only delete the old image after a successful replace with a new upload.
  if (
    // Contribute this line to the enclosing declaration or statement.
    file &&
    // Contribute this line to the enclosing declaration or statement.
    previousImage &&
    // Continue the surrounding logic with this statement.
    previousImage !== carPayload.image &&
    // Call storage.isManagedPublicUrl to perform this step.
    storage.isManagedPublicUrl(previousImage)
  // Continue the surrounding logic with this statement.
  ) {
    // Wait until the asynchronous operation resolves.
    await deleteManagedImageIfUnused(previousImage);
  }

  // Create the refreshed constant.
  const refreshed = await carRepository.findByIdForAdmin(id);

  // Return the resulting value to the caller.
  return {
    // Provide the car field value.
    car: refreshed || updated,
    // Provide the audit field value.
    audit: {
      // Provide the price changed field value.
      priceChanged: priceTiersChanged(previousTiers, newTiers),
      // Contribute this line to the enclosing declaration or statement.
      previousTiers,
      // Contribute this line to the enclosing declaration or statement.
      newTiers,
      // Provide the name field value.
      name: refreshed?.name ?? updated?.name ?? carPayload.name,
    },
  };
}

/**
 * Soft-delete a car only when no active fleet reservations remain.
 * @param {number|string} id
 */
async function deleteCar(id) {
  // Create the existing car constant.
  const existingCar = await carRepository.findByIdForAdmin(id);
  // Idempotency guard: return early when work was already applied.
  if (!existingCar) {
    // Throw an error to stop the current control flow.
    throw new Error('Car not found');
  }

  // Create the active bookings constant.
  const activeBookings = await carSql.countActiveFleetReservations(id);
  // Evaluate the condition and enter the branch when it is true.
  if (activeBookings > 0) {
    // Throw an error to stop the current control flow.
    throw new ConflictError('Cannot delete car with active bookings', {
      // Contribute this line to the enclosing declaration or statement.
      activeBookings,
    });
  }

  // Create the deleted constant.
  const deleted = await carRepository.deleteById(id);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!deleted) {
    // Throw an error to stop the current control flow.
    throw new Error('Car not found');
  }

  // Idempotency guard: return early when work was already applied.
  if (existingCar.image && storage.isManagedPublicUrl(existingCar.image)) {
    // Wait until the asynchronous operation resolves.
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
    // Create the err constant.
    const err = new Error('Invalid car status');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the existing constant.
  const existing = await carRepository.findByIdForAdmin(id);
  // Idempotency guard: return early when work was already applied.
  if (!existing || existing.isDeleted) {
    // Throw an error to stop the current control flow.
    throw new Error('Car not found');
  }

  // Create the car constant.
  const car = await carSql.updateCarStatus(id, status);
  // Return the resulting value to the caller.
  return { car, oldStatus: existing.status, newStatus: status, reason };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listCars,
  // Contribute this line to the enclosing declaration or statement.
  getCarById,
  // Contribute this line to the enclosing declaration or statement.
  createCar,
  // Contribute this line to the enclosing declaration or statement.
  updateCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteCar,
  // Contribute this line to the enclosing declaration or statement.
  changeFleetStatus,
};
