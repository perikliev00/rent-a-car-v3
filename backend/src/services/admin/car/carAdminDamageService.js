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

async function listDamageReports(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  return damageReportSql.listByCarId(carId);
}

async function createDamageReport(carId, body, files = [], userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');

  const photos = (files || []).map((f) => buildImagePath(f));
  const report = await damageReportSql.create(carId, {
    description: body.description,
    reservationId: emptyToNull(body.reservationId),
    repairCost: parseOptionalFloat(body.repairCost),
    photos,
    reportedByUserId: userId,
  });

  if (car.status !== 'rented' && car.status !== 'reserved') {
    await carSql.updateCarStatus(carId, 'damaged');
  }

  await reconcileFleetAlertsQuietly();
  return report;
}

async function resolveDamageReport(carId, reportId) {
  const report = await damageReportSql.resolve(carId, reportId);
  if (!report) throw new Error('Damage report not found');
  await reconcileFleetAlertsQuietly();
  return report;
}

async function deleteDamageReport(carId, reportId) {
  const existing = await damageReportSql.findById(carId, reportId);
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
