const carRepository = require('../../../repositories/carRepository');
const complianceSql = require('../../sql/carComplianceSqlService');
const { COMPLIANCE_TYPES } = require('../../../constants/carEnums');
const {
  buildImagePath,
  deleteManagedImageIfUnused,
  emptyToNull,
} = require('./carAdminHelpers');

async function getFleetAlerts() {
  const fleetAlertsSql = require('../../sql/carFleetAlertsSqlService');
  return fleetAlertsSql.listFleetAlerts();
}

async function reconcileFleetAlerts(now = new Date()) {
  const reconcile = require('../../carFleetAlertReconcileService');
  return reconcile.reconcileFleetAlerts({ now });
}

async function reconcileFleetAlertsQuietly() {
  try {
    await reconcileFleetAlerts(new Date());
  } catch (err) {
    // Alerts refresh on the next background job; do not fail the mutation
    const logger = require('../../../utils/logger');
    logger.error({ err, context: 'reconcileFleetAlertsQuietly' }, 'Fleet alert reconcile after mutation failed');
  }
}

async function syncInsuranceInspectionCompliance(carId, payload, userId = null) {
  if (Object.prototype.hasOwnProperty.call(payload, 'insuranceExpiry')) {
    const expiresAt = emptyToNull(payload.insuranceExpiry);
    if (expiresAt) {
      await complianceSql.upsertByType(carId, 'civil_insurance', {
        expiresAt,
        createdByUserId: userId,
      });
    }
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'technicalInspectionExpiry')) {
    const expiresAt = emptyToNull(payload.technicalInspectionExpiry);
    if (expiresAt) {
      await complianceSql.upsertByType(carId, 'technical_inspection', {
        expiresAt,
        createdByUserId: userId,
      });
    }
  }
  await complianceSql.syncCarExpiryCache(carId);
}

function buildCompliancePayload(body, file = null, existing = null) {
  const itemType = body.itemType || existing?.itemType;
  if (!COMPLIANCE_TYPES.includes(itemType)) {
    throw new Error('Invalid compliance type');
  }

  let documentUrl = null;
  if (file) {
    documentUrl = buildImagePath(file);
  }

  return {
    itemType,
    title: emptyToNull(body.title),
    referenceNumber: emptyToNull(body.referenceNumber),
    issuedAt: emptyToNull(body.issuedAt),
    expiresAt: emptyToNull(body.expiresAt),
    notes: emptyToNull(body.notes),
    documentUrl,
    status: body.status === 'missing' ? 'missing' : undefined,
  };
}

async function listCompliance(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  return complianceSql.listByCarId(carId);
}

async function createCompliance(carId, body, file = null, userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');

  const payload = buildCompliancePayload(body, file);
  const item = await complianceSql.create(carId, {
    ...payload,
    createdByUserId: userId,
  });

  if (item.itemType === 'civil_insurance' || item.itemType === 'technical_inspection') {
    await complianceSql.syncCarExpiryCache(carId);
  }
  await reconcileFleetAlertsQuietly();
  return item;
}

async function updateCompliance(carId, itemId, body, file = null) {
  const existing = await complianceSql.findById(carId, itemId);
  if (!existing) throw new Error('Compliance item not found');

  const payload = buildCompliancePayload(body, file, existing);
  const item = await complianceSql.update(carId, itemId, {
    itemType: payload.itemType,
    title: body.title !== undefined ? payload.title : existing.title,
    referenceNumber:
      body.referenceNumber !== undefined ? payload.referenceNumber : existing.referenceNumber,
    issuedAt: body.issuedAt !== undefined ? payload.issuedAt : existing.issuedAt,
    expiresAt: body.expiresAt !== undefined ? payload.expiresAt : existing.expiresAt,
    notes: body.notes !== undefined ? payload.notes : existing.notes,
    documentUrl: payload.documentUrl,
    status: body.status === 'missing' ? 'missing' : undefined,
  });

  if (item.itemType === 'civil_insurance' || item.itemType === 'technical_inspection') {
    await complianceSql.syncCarExpiryCache(carId);
  }
  await reconcileFleetAlertsQuietly();
  return item;
}

async function deleteCompliance(carId, itemId) {
  const existing = await complianceSql.findById(carId, itemId);
  if (!existing) throw new Error('Compliance item not found');
  const removed = await complianceSql.remove(carId, itemId);
  if (existing.documentUrl) {
    await deleteManagedImageIfUnused(existing.documentUrl);
  }
  if (
    existing.itemType === 'civil_insurance' ||
    existing.itemType === 'technical_inspection'
  ) {
    await complianceSql.syncCarExpiryCache(carId);
  }
  await reconcileFleetAlertsQuietly();
  return removed;
}

module.exports = {
  getFleetAlerts,
  reconcileFleetAlerts,
  reconcileFleetAlertsQuietly,
  syncInsuranceInspectionCompliance,
  listCompliance,
  createCompliance,
  updateCompliance,
  deleteCompliance,
};
