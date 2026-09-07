const fs = require('fs');
const path = require('path');
const carRepository = require('../../../repositories/carRepository');
const complianceSql = require('../../sql/carComplianceSqlService');
const privateStorage = require('../../storage/privateStorageService');
const publicStorage = require('../../storage');
const { COMPLIANCE_TYPES } = require('../../../constants/carEnums');
const {
  deleteManagedImageIfUnused,
  emptyToNull,
} = require('./carAdminHelpers');
const { removeUploadedFile } = require('../../../middleware/fileUpload/uploadUtils');

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

async function storeComplianceUpload(file) {
  if (!file) return null;
  try {
    const stored = await privateStorage.storePrivateFile({
      tempPath: file.path,
      originalName: file.originalname,
      category: 'compliance',
      mimeType: file.mimetype,
    });
    return stored.storageKey;
  } catch (err) {
    await removeUploadedFile(file);
    throw err;
  }
}

async function openLegacyPublicReadStream(legacyUrl) {
  if (!legacyUrl || !publicStorage.isManagedPublicUrl(legacyUrl)) {
    return null;
  }
  if (typeof publicStorage.openManagedPublicReadStream === 'function') {
    return publicStorage.openManagedPublicReadStream(legacyUrl);
  }
  if (publicStorage.driver === 'local' && publicStorage.PUBLIC_CAR_IMAGES_DIR) {
    const filename = path.basename(legacyUrl);
    const filePath = path.resolve(publicStorage.PUBLIC_CAR_IMAGES_DIR, filename);
    if (!filePath.startsWith(path.resolve(publicStorage.PUBLIC_CAR_IMAGES_DIR))) {
      return null;
    }
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
    } catch {
      return null;
    }
    return {
      stream: fs.createReadStream(filePath),
      mimeType: 'image/jpeg',
    };
  }
  return null;
}

function buildCompliancePayload(body, documentStorageKey = null, existing = null) {
  const itemType = body.itemType || existing?.itemType;
  if (!COMPLIANCE_TYPES.includes(itemType)) {
    throw new Error('Invalid compliance type');
  }

  return {
    itemType,
    title: emptyToNull(body.title),
    referenceNumber: emptyToNull(body.referenceNumber),
    issuedAt: emptyToNull(body.issuedAt),
    expiresAt: emptyToNull(body.expiresAt),
    notes: emptyToNull(body.notes),
    documentStorageKey,
    status: body.status === 'missing' ? 'missing' : undefined,
  };
}

async function listCompliance(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  const items = await complianceSql.listByCarId(carId);
  return items.map(complianceSql.toPublicComplianceItem);
}

async function createCompliance(carId, body, file = null, userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');

  const documentStorageKey = await storeComplianceUpload(file);
  const payload = buildCompliancePayload(body, documentStorageKey);
  let item;
  try {
    item = await complianceSql.create(carId, {
      ...payload,
      createdByUserId: userId,
    });
  } catch (err) {
    if (documentStorageKey) {
      await privateStorage.deletePrivateFile(documentStorageKey);
    }
    throw err;
  }

  if (item.itemType === 'civil_insurance' || item.itemType === 'technical_inspection') {
    await complianceSql.syncCarExpiryCache(carId);
  }
  await reconcileFleetAlertsQuietly();
  return complianceSql.toPublicComplianceItem(item);
}

async function updateCompliance(carId, itemId, body, file = null) {
  const existing = await complianceSql.findById(carId, itemId);
  if (!existing) throw new Error('Compliance item not found');

  const documentStorageKey = await storeComplianceUpload(file);
  const payload = buildCompliancePayload(body, documentStorageKey, existing);
  let item;
  try {
    item = await complianceSql.update(carId, itemId, {
      itemType: payload.itemType,
      title: body.title !== undefined ? payload.title : existing.title,
      referenceNumber:
        body.referenceNumber !== undefined ? payload.referenceNumber : existing.referenceNumber,
      issuedAt: body.issuedAt !== undefined ? payload.issuedAt : existing.issuedAt,
      expiresAt: body.expiresAt !== undefined ? payload.expiresAt : existing.expiresAt,
      notes: body.notes !== undefined ? payload.notes : existing.notes,
      documentStorageKey,
      status: body.status === 'missing' ? 'missing' : undefined,
    });
  } catch (err) {
    if (documentStorageKey) {
      await privateStorage.deletePrivateFile(documentStorageKey);
    }
    throw err;
  }

  if (documentStorageKey) {
    if (existing.documentStorageKey) {
      await privateStorage.deletePrivateFile(existing.documentStorageKey);
    }
    if (existing.documentUrl) {
      await deleteManagedImageIfUnused(existing.documentUrl);
    }
  }

  if (item.itemType === 'civil_insurance' || item.itemType === 'technical_inspection') {
    await complianceSql.syncCarExpiryCache(carId);
  }
  await reconcileFleetAlertsQuietly();
  return complianceSql.toPublicComplianceItem(item);
}

async function deleteCompliance(carId, itemId) {
  const existing = await complianceSql.findById(carId, itemId);
  if (!existing) throw new Error('Compliance item not found');
  const removed = await complianceSql.remove(carId, itemId);
  if (existing.documentStorageKey) {
    await privateStorage.deletePrivateFile(existing.documentStorageKey);
  }
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
  return complianceSql.toPublicComplianceItem(removed);
}

async function openComplianceDocumentDownload(carId, itemId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');

  const item = await complianceSql.findById(carId, itemId);
  if (!item) {
    const err = new Error('Compliance item not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (!item.hasDocument) {
    const err = new Error('File is no longer available');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (item.documentStorageKey) {
    const opened = await privateStorage.openPrivateReadStream(item.documentStorageKey);
    if (!opened) {
      const err = new Error('File is no longer available');
      err.code = 'NOT_FOUND';
      err.status = 404;
      throw err;
    }
    return {
      item,
      stream: opened.stream,
      mimeType: 'application/octet-stream',
      filename: `${item.itemType || 'compliance'}-${item.id}`,
    };
  }

  const opened = await openLegacyPublicReadStream(item.documentUrl);
  if (!opened) {
    const err = new Error('File is no longer available');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return {
    item,
    stream: opened.stream,
    mimeType: opened.mimeType || 'image/jpeg',
    filename: `${item.itemType || 'compliance'}-${item.id}`,
  };
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
  openComplianceDocumentDownload,
};
