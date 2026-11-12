/**
 * Admin CRUD for per-car service/maintenance history records.
 */
const carRepository = require('../../../repositories/carRepository');
// Require the '../../sql/carServiceRecordSqlService' module as serviceRecordSql.
const serviceRecordSql = require('../../sql/carServiceRecordSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  emptyToNull,
  // Contribute this line to the enclosing declaration or statement.
  parseOptionalInt,
  // Contribute this line to the enclosing declaration or statement.
  parseOptionalFloat,
// Continue the surrounding logic with this statement.
} = require('./carAdminHelpers');

/** @param {number|string} carId */
async function listServiceRecords(carId) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  // Return the resulting value to the caller.
  return serviceRecordSql.listByCarId(carId);
}

/**
 * @param {number|string} carId
 * @param {object} body
 * @param {number|null} [userId]
 */
async function createServiceRecord(carId, body, userId = null) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  // Return the resulting value to the caller.
  return serviceRecordSql.create(carId, {
    // Provide the service type field value.
    serviceType: body.serviceType,
    // Provide the description field value.
    description: body.description || null,
    // Provide the cost field value.
    cost: parseOptionalFloat(body.cost),
    // Provide the mileage field value.
    mileage: parseOptionalInt(body.mileage),
    // Provide the service date field value.
    serviceDate: body.serviceDate,
    // Provide the next service date field value.
    nextServiceDate: emptyToNull(body.nextServiceDate),
    // Provide the created by user id field value.
    createdByUserId: userId,
  });
}

/**
 * Update or upsert service record; returns null when not found.
 * @param {string|number} carId
 * @param {string|number} recordId
 * @param {*} body
 * @returns {Promise<*>}
 */
async function updateServiceRecord(carId, recordId, body) {
  // Create the existing constant.
  const existing = await serviceRecordSql.findById(carId, recordId);
  // Idempotency guard: return early when work was already applied.
  if (!existing) throw new Error('Service record not found');
  // Return the resulting value to the caller.
  return serviceRecordSql.update(carId, recordId, {
    // Provide the service type field value.
    serviceType: body.serviceType ?? existing.serviceType,
    // Provide the description field value.
    description: body.description !== undefined ? body.description : existing.description,
    // Provide the cost field value.
    cost: body.cost !== undefined ? parseOptionalFloat(body.cost) : existing.cost,
    // Provide the mileage field value.
    mileage: body.mileage !== undefined ? parseOptionalInt(body.mileage) : existing.mileage,
    // Provide the service date field value.
    serviceDate: body.serviceDate ?? existing.serviceDate,
    // Provide the next service date field value.
    nextServiceDate:
      // Continue the surrounding logic with this statement.
      body.nextServiceDate !== undefined
        // Continue the surrounding logic with this statement.
        ? emptyToNull(body.nextServiceDate)
        // Contribute this line to the enclosing declaration or statement.
        : existing.nextServiceDate,
  });
}

/**
 * Delete service record; returns whether a row was affected.
 * @param {string|number} carId
 * @param {string|number} recordId
 * @returns {Promise<*>}
 */
async function deleteServiceRecord(carId, recordId) {
  // Create the ok constant.
  const ok = await serviceRecordSql.remove(carId, recordId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!ok) throw new Error('Service record not found');
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listServiceRecords,
  // Contribute this line to the enclosing declaration or statement.
  createServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  updateServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  deleteServiceRecord,
};
