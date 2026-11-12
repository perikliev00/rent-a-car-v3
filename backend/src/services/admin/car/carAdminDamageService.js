/**
 * Admin damage reports: create/resolve/delete and optionally mark the car damaged.
 * Mutations trigger a quiet fleet-alert reconcile so unresolved-damage alerts stay fresh.
 */
const carRepository = require('../../../repositories/carRepository');
// Require the '../../sql/carSqlService' module as carSql.
const carSql = require('../../sql/carSqlService');
// Require the '../../sql/carDamageReportSqlService' module as damageReportSql.
const damageReportSql = require('../../sql/carDamageReportSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildImagePath,
  // Contribute this line to the enclosing declaration or statement.
  deleteManagedImageIfUnused,
  // Contribute this line to the enclosing declaration or statement.
  emptyToNull,
  // Contribute this line to the enclosing declaration or statement.
  parseOptionalFloat,
// Continue the surrounding logic with this statement.
} = require('./carAdminHelpers');
// Destructure object properties into local variables.
const { reconcileFleetAlertsQuietly } = require('./carAdminComplianceService');

/** @param {number|string} carId */
async function listDamageReports(carId) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  // Return the resulting value to the caller.
  return damageReportSql.listByCarId(carId);
}

/**
 * Create a damage report; marks car damaged unless already rented/reserved
 * (those statuses take precedence over the damaged flag mid-booking).
 * @param {number|string} carId
 * @param {object} body
 * @param {object[]} [files]
 * @param {number|null} [userId]
 */
async function createDamageReport(carId, body, files = [], userId = null) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');

  // Create the photos constant.
  const photos = (files || []).map((f) => buildImagePath(f));
  // Create the report constant.
  const report = await damageReportSql.create(carId, {
    // Provide the description field value.
    description: body.description,
    // Provide the reservation id field value.
    reservationId: emptyToNull(body.reservationId),
    // Provide the repair cost field value.
    repairCost: parseOptionalFloat(body.repairCost),
    // Contribute this line to the enclosing declaration or statement.
    photos,
    // Provide the reported by user id field value.
    reportedByUserId: userId,
  });

  // Do not override rented/reserved — fleet sync owns those during an active booking.
  if (car.status !== 'rented' && car.status !== 'reserved') {
    // Wait until the asynchronous operation resolves.
    await carSql.updateCarStatus(carId, 'damaged');
  }

  // Wait until the asynchronous operation resolves.
  await reconcileFleetAlertsQuietly();
  // Return the resulting value to the caller.
  return report;
}

/** @param {number|string} carId @param {number|string} reportId */
async function resolveDamageReport(carId, reportId) {
  // Create the report constant.
  const report = await damageReportSql.resolve(carId, reportId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!report) throw new Error('Damage report not found');
  // Wait until the asynchronous operation resolves.
  await reconcileFleetAlertsQuietly();
  // Return the resulting value to the caller.
  return report;
}

/**
 * Delete damage report; returns whether a row was affected.
 * @param {string|number} carId
 * @param {string|number} reportId
 * @returns {Promise<*>}
 */
async function deleteDamageReport(carId, reportId) {
  // Create the existing constant.
  const existing = await damageReportSql.findById(carId, reportId);
  // Idempotency guard: return early when work was already applied.
  if (!existing) throw new Error('Damage report not found');
  // Wait until the asynchronous operation resolves.
  await damageReportSql.remove(carId, reportId);
  // Iterate using the loop initializer, condition, and step.
  for (const url of existing.photos || []) {
    // Wait until the asynchronous operation resolves.
    await deleteManagedImageIfUnused(url);
  }
  // Wait until the asynchronous operation resolves.
  await reconcileFleetAlertsQuietly();
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listDamageReports,
  // Contribute this line to the enclosing declaration or statement.
  createDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  resolveDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  deleteDamageReport,
};
