/**
 * Admin CRUD for per-car service/maintenance history records.
 */
const carRepository = require('../../../repositories/carRepository');
const serviceRecordSql = require('../../sql/carServiceRecordSqlService');
const {
  emptyToNull,
  parseOptionalInt,
  parseOptionalFloat,
} = require('./carAdminHelpers');

/** @param {number|string} carId */
async function listServiceRecords(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  return serviceRecordSql.listByCarId(carId);
}

/**
 * @param {number|string} carId
 * @param {object} body
 * @param {number|null} [userId]
 */
async function createServiceRecord(carId, body, userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  return serviceRecordSql.create(carId, {
    serviceType: body.serviceType,
    description: body.description || null,
    cost: parseOptionalFloat(body.cost),
    mileage: parseOptionalInt(body.mileage),
    serviceDate: body.serviceDate,
    nextServiceDate: emptyToNull(body.nextServiceDate),
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
  const existing = await serviceRecordSql.findById(carId, recordId);
  // Idempotency guard: return early when work was already applied.
  if (!existing) throw new Error('Service record not found');
  return serviceRecordSql.update(carId, recordId, {
    serviceType: body.serviceType ?? existing.serviceType,
    description: body.description !== undefined ? body.description : existing.description,
    cost: body.cost !== undefined ? parseOptionalFloat(body.cost) : existing.cost,
    mileage: body.mileage !== undefined ? parseOptionalInt(body.mileage) : existing.mileage,
    serviceDate: body.serviceDate ?? existing.serviceDate,
    nextServiceDate:
      body.nextServiceDate !== undefined
        ? emptyToNull(body.nextServiceDate)
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
  const ok = await serviceRecordSql.remove(carId, recordId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!ok) throw new Error('Service record not found');
}

module.exports = {
  listServiceRecords,
  createServiceRecord,
  updateServiceRecord,
  deleteServiceRecord,
};
