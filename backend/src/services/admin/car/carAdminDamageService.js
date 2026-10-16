/**
 * Admin damage reports: create/resolve/delete and optionally mark the car damaged.
 * Mutations trigger a quiet fleet-alert reconcile so unresolved-damage alerts stay fresh.
 */
const carRepository = require('../../../repositories/carRepository');
const carSql = require('../../sql/carSqlService');
const damageReportSql = require('../../sql/carDamageReportSqlService');
const {
  buildImagePath,
  deleteManagedImageIfUnused,
  emptyToNull,
  parseOptionalFloat,
} = require('./carAdminHelpers');
const { reconcileFleetAlertsQuietly } = require('./carAdminComplianceService');

/** @param {number|string} carId */
async function listDamageReports(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
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
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');

  const photos = (files || []).map((f) => buildImagePath(f));
  const report = await damageReportSql.create(carId, {
    description: body.description,
    reservationId: emptyToNull(body.reservationId),
    repairCost: parseOptionalFloat(body.repairCost),
    photos,
    reportedByUserId: userId,
  });

  // Do not override rented/reserved — fleet sync owns those during an active booking.
  if (car.status !== 'rented' && car.status !== 'reserved') {
    await carSql.updateCarStatus(carId, 'damaged');
  }

  await reconcileFleetAlertsQuietly();
  return report;
}

/** @param {number|string} carId @param {number|string} reportId */
async function resolveDamageReport(carId, reportId) {
  const report = await damageReportSql.resolve(carId, reportId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!report) throw new Error('Damage report not found');
  await reconcileFleetAlertsQuietly();
  return report;
}

/**
 * Delete damage report; returns whether a row was affected.
 * @param {string|number} carId
 * @param {string|number} reportId
 * @returns {Promise<*>}
 */
async function deleteDamageReport(carId, reportId) {
  const existing = await damageReportSql.findById(carId, reportId);
  // Idempotency guard: return early when work was already applied.
  if (!existing) throw new Error('Damage report not found');
  await damageReportSql.remove(carId, reportId);
  for (const url of existing.photos || []) {
    await deleteManagedImageIfUnused(url);
  }
  await reconcileFleetAlertsQuietly();
}

module.exports = {
  listDamageReports,
  createDamageReport,
  resolveDamageReport,
  deleteDamageReport,
};
