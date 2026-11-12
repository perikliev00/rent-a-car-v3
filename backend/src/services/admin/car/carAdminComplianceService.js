/**
 * Admin compliance items (insurance, vignette, inspection, etc.) plus fleet-alert
 * helpers. Car form insurance/inspection expiry fields are mirrored into compliance rows.
 */
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Require the '../../../repositories/carRepository' module as carRepository.
const carRepository = require('../../../repositories/carRepository');
// Require the '../../sql/carComplianceSqlService' module as complianceSql.
const complianceSql = require('../../sql/carComplianceSqlService');
// Require the '../../storage/privateStorageService' module as privateStorage.
const privateStorage = require('../../storage/privateStorageService');
// Require the '../../storage' module as publicStorage.
const publicStorage = require('../../storage');
// Destructure object properties into local variables.
const { COMPLIANCE_TYPES } = require('../../../constants/carEnums');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  deleteManagedImageIfUnused,
  // Contribute this line to the enclosing declaration or statement.
  emptyToNull,
// Continue the surrounding logic with this statement.
} = require('./carAdminHelpers');
// Destructure object properties into local variables.
const { removeUploadedFile } = require('../../../middleware/fileUpload/uploadUtils');

/** Active fleet alerts for the admin dashboard. */
async function getFleetAlerts() {
  // Require the '../../sql/carFleetAlertsSqlService' module as fleetAlertsSql.
  const fleetAlertsSql = require('../../sql/carFleetAlertsSqlService');
  // Return the resulting value to the caller.
  return fleetAlertsSql.listFleetAlerts();
}

/** @param {Date} [now] */
async function reconcileFleetAlerts(now = new Date()) {
  // Require the '../../carFleetAlertReconcileService' module as reconcile.
  const reconcile = require('../../carFleetAlertReconcileService');
  // Return the resulting value to the caller.
  return reconcile.reconcileFleetAlerts({ now });
}

/**
 * Best-effort reconcile after mutations; never throws into the caller.
 */
async function reconcileFleetAlertsQuietly() {
  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await reconcileFleetAlerts(new Date());
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Require the '../../../utils/logger' module as logger.
    const logger = require('../../../utils/logger');
    // Call logger.error to perform this step.
    logger.error({ err, context: 'reconcileFleetAlertsQuietly' }, 'Fleet alert reconcile after mutation failed');
  }
}

/**
 * Upsert civil_insurance / technical_inspection compliance from car form expiry fields,
 * then refresh the denormalized car expiry cache columns.
 * @param {number|string} carId
 * @param {object} payload
 * @param {number|null} [userId]
 */
async function syncInsuranceInspectionCompliance(carId, payload, userId = null) {
  // Evaluate the condition and enter the branch when it is true.
  if (Object.prototype.hasOwnProperty.call(payload, 'insuranceExpiry')) {
    // Create the expires at constant.
    const expiresAt = emptyToNull(payload.insuranceExpiry);
    // Evaluate the condition and enter the branch when it is true.
    if (expiresAt) {
      // Wait until the asynchronous operation resolves.
      await complianceSql.upsertByType(carId, 'civil_insurance', {
        // Contribute this line to the enclosing declaration or statement.
        expiresAt,
        // Provide the created by user id field value.
        createdByUserId: userId,
      });
    }
  }
  // Evaluate the condition and enter the branch when it is true.
  if (Object.prototype.hasOwnProperty.call(payload, 'technicalInspectionExpiry')) {
    // Create the expires at constant.
    const expiresAt = emptyToNull(payload.technicalInspectionExpiry);
    // Evaluate the condition and enter the branch when it is true.
    if (expiresAt) {
      // Wait until the asynchronous operation resolves.
      await complianceSql.upsertByType(carId, 'technical_inspection', {
        // Contribute this line to the enclosing declaration or statement.
        expiresAt,
        // Provide the created by user id field value.
        createdByUserId: userId,
      });
    }
  }
  // Wait until the asynchronous operation resolves.
  await complianceSql.syncCarExpiryCache(carId);
}

/**
 * store compliance upload.
 * @param {*} file
 * @returns {Promise<*>}
 */
async function storeComplianceUpload(file) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!file) return null;
  // Protected block: isolate failure modes.
  try {
    // Create the stored constant.
    const stored = await privateStorage.storePrivateFile({
      // Provide the temp path field value.
      tempPath: file.path,
      // Provide the original name field value.
      originalName: file.originalname,
      // Provide the category field value.
      category: 'compliance',
      // Provide the mime type field value.
      mimeType: file.mimetype,
    });
    // Return the resulting value to the caller.
    return stored.storageKey;
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await removeUploadedFile(file);
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * open legacy public read stream.
 * @param {*} legacyUrl
 * @returns {Promise<*>}
 */
async function openLegacyPublicReadStream(legacyUrl) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!legacyUrl || !publicStorage.isManagedPublicUrl(legacyUrl)) {
    // Return the resulting value to the caller.
    return null;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (typeof publicStorage.openManagedPublicReadStream === 'function') {
    // Return the resulting value to the caller.
    return publicStorage.openManagedPublicReadStream(legacyUrl);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (publicStorage.driver === 'local' && publicStorage.PUBLIC_CAR_IMAGES_DIR) {
    // Create the filename constant.
    const filename = path.basename(legacyUrl);
    // Create the file path constant.
    const filePath = path.resolve(publicStorage.PUBLIC_CAR_IMAGES_DIR, filename);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!filePath.startsWith(path.resolve(publicStorage.PUBLIC_CAR_IMAGES_DIR))) {
      // Return the resulting value to the caller.
      return null;
    }
    // Protected block: isolate failure modes.
    try {
      // Wait until the asynchronous operation resolves.
      await fs.promises.access(filePath, fs.constants.R_OK);
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // Return the resulting value to the caller.
      return null;
    }
    // Return the resulting value to the caller.
    return {
      // Provide the stream field value.
      stream: fs.createReadStream(filePath),
      // Provide the mime type field value.
      mimeType: 'image/jpeg',
    };
  }
  // Return the resulting value to the caller.
  return null;
}

/**
 * Normalize compliance form body into a SQL create/update payload.
 * Explicit status "missing" is preserved; otherwise status is left for SQL defaults.
 */
function buildCompliancePayload(body, documentStorageKey = null, existing = null) {
  // Create the item type constant.
  const itemType = body.itemType || existing?.itemType;
  // Guard: early-return or throw when required input is missing/invalid.
  if (!COMPLIANCE_TYPES.includes(itemType)) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid compliance type');
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    itemType,
    // Provide the title field value.
    title: emptyToNull(body.title),
    // Provide the reference number field value.
    referenceNumber: emptyToNull(body.referenceNumber),
    // Provide the issued at field value.
    issuedAt: emptyToNull(body.issuedAt),
    // Provide the expires at field value.
    expiresAt: emptyToNull(body.expiresAt),
    // Provide the notes field value.
    notes: emptyToNull(body.notes),
    // Contribute this line to the enclosing declaration or statement.
    documentStorageKey,
    // Provide the status field value.
    status: body.status === 'missing' ? 'missing' : undefined,
  };
}

/** @param {number|string} carId */
async function listCompliance(carId) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  // Create the items constant.
  const items = await complianceSql.listByCarId(carId);
  // Return the resulting value to the caller.
  return items.map(complianceSql.toPublicComplianceItem);
}

/**
 * Create compliance item; rolls back uploaded file on DB failure.
 * Insurance/inspection types also refresh the car expiry cache for list views.
 */
async function createCompliance(carId, body, file = null, userId = null) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');

  // Create the document storage key constant.
  const documentStorageKey = await storeComplianceUpload(file);
  // Create the payload constant.
  const payload = buildCompliancePayload(body, documentStorageKey);
  // Reserve the item variable for later assignment.
  let item;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in item.
    item = await complianceSql.create(carId, {
      // Spread payload into the surrounding structure.
      ...payload,
      // Provide the created by user id field value.
      createdByUserId: userId,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (documentStorageKey) {
      // Wait until the asynchronous operation resolves.
      await privateStorage.deletePrivateFile(documentStorageKey);
    }
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (item.itemType === 'civil_insurance' || item.itemType === 'technical_inspection') {
    // Wait until the asynchronous operation resolves.
    await complianceSql.syncCarExpiryCache(carId);
  }
  // Wait until the asynchronous operation resolves.
  await reconcileFleetAlertsQuietly();
  // Return the resulting value to the caller.
  return complianceSql.toPublicComplianceItem(item);
}

/** Update compliance; replaces document and cleans previous storage when a new file is uploaded. */
async function updateCompliance(carId, itemId, body, file = null) {
  // Create the existing constant.
  const existing = await complianceSql.findById(carId, itemId);
  // Idempotency guard: return early when work was already applied.
  if (!existing) throw new Error('Compliance item not found');

  // Create the document storage key constant.
  const documentStorageKey = await storeComplianceUpload(file);
  // Create the payload constant.
  const payload = buildCompliancePayload(body, documentStorageKey, existing);
  // Reserve the item variable for later assignment.
  let item;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in item.
    item = await complianceSql.update(carId, itemId, {
      // Provide the item type field value.
      itemType: payload.itemType,
      // Provide the title field value.
      title: body.title !== undefined ? payload.title : existing.title,
      // Provide the reference number field value.
      referenceNumber:
        // Continue the surrounding logic with this statement.
        body.referenceNumber !== undefined ? payload.referenceNumber : existing.referenceNumber,
      // Provide the issued at field value.
      issuedAt: body.issuedAt !== undefined ? payload.issuedAt : existing.issuedAt,
      // Provide the expires at field value.
      expiresAt: body.expiresAt !== undefined ? payload.expiresAt : existing.expiresAt,
      // Provide the notes field value.
      notes: body.notes !== undefined ? payload.notes : existing.notes,
      // Contribute this line to the enclosing declaration or statement.
      documentStorageKey,
      // Provide the status field value.
      status: body.status === 'missing' ? 'missing' : undefined,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (documentStorageKey) {
      // Wait until the asynchronous operation resolves.
      await privateStorage.deletePrivateFile(documentStorageKey);
    }
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (documentStorageKey) {
    // Idempotency guard: return early when work was already applied.
    if (existing.documentStorageKey) {
      // Wait until the asynchronous operation resolves.
      await privateStorage.deletePrivateFile(existing.documentStorageKey);
    }
    // Idempotency guard: return early when work was already applied.
    if (existing.documentUrl) {
      // Wait until the asynchronous operation resolves.
      await deleteManagedImageIfUnused(existing.documentUrl);
    }
  }

  // Evaluate the condition and enter the branch when it is true.
  if (item.itemType === 'civil_insurance' || item.itemType === 'technical_inspection') {
    // Wait until the asynchronous operation resolves.
    await complianceSql.syncCarExpiryCache(carId);
  }
  // Wait until the asynchronous operation resolves.
  await reconcileFleetAlertsQuietly();
  // Return the resulting value to the caller.
  return complianceSql.toPublicComplianceItem(item);
}

/**
 * Delete compliance; returns whether a row was affected.
 * @param {string|number} carId
 * @param {string|number} itemId
 * @returns {Promise<*>}
 */
async function deleteCompliance(carId, itemId) {
  // Create the existing constant.
  const existing = await complianceSql.findById(carId, itemId);
  // Idempotency guard: return early when work was already applied.
  if (!existing) throw new Error('Compliance item not found');
  // Create the removed constant.
  const removed = await complianceSql.remove(carId, itemId);
  // Idempotency guard: return early when work was already applied.
  if (existing.documentStorageKey) {
    // Wait until the asynchronous operation resolves.
    await privateStorage.deletePrivateFile(existing.documentStorageKey);
  }
  // Idempotency guard: return early when work was already applied.
  if (existing.documentUrl) {
    // Wait until the asynchronous operation resolves.
    await deleteManagedImageIfUnused(existing.documentUrl);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (
    // Update existing.itemType with the right-hand side value.
    existing.itemType === 'civil_insurance' ||
    // Update existing.itemType with the right-hand side value.
    existing.itemType === 'technical_inspection'
  // Continue the surrounding logic with this statement.
  ) {
    // Wait until the asynchronous operation resolves.
    await complianceSql.syncCarExpiryCache(carId);
  }
  // Wait until the asynchronous operation resolves.
  await reconcileFleetAlertsQuietly();
  // Return the resulting value to the caller.
  return complianceSql.toPublicComplianceItem(removed);
}

/**
 * open compliance document download.
 * @param {string|number} carId
 * @param {string|number} itemId
 * @returns {Promise<*>}
 */
async function openComplianceDocumentDownload(carId, itemId) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');

  // Create the item constant.
  const item = await complianceSql.findById(carId, itemId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!item) {
    // Create the err constant.
    const err = new Error('Compliance item not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!item.hasDocument) {
    // Create the err constant.
    const err = new Error('File is no longer available');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (item.documentStorageKey) {
    // Create the opened constant.
    const opened = await privateStorage.openPrivateReadStream(item.documentStorageKey);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!opened) {
      // Create the err constant.
      const err = new Error('File is no longer available');
      // Update err.code with the right-hand side value.
      err.code = 'NOT_FOUND';
      // Update err.status with the right-hand side value.
      err.status = 404;
      // Throw an error to stop the current control flow.
      throw err;
    }
    // Return the resulting value to the caller.
    return {
      // Contribute this line to the enclosing declaration or statement.
      item,
      // Provide the stream field value.
      stream: opened.stream,
      // Provide the mime type field value.
      mimeType: 'application/octet-stream',
      // Provide the filename field value.
      filename: `${item.itemType || 'compliance'}-${item.id}`,
    };
  }

  // Create the opened constant.
  const opened = await openLegacyPublicReadStream(item.documentUrl);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!opened) {
    // Create the err constant.
    const err = new Error('File is no longer available');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    item,
    // Provide the stream field value.
    stream: opened.stream,
    // Provide the mime type field value.
    mimeType: opened.mimeType || 'image/jpeg',
    // Provide the filename field value.
    filename: `${item.itemType || 'compliance'}-${item.id}`,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlerts,
  // Contribute this line to the enclosing declaration or statement.
  reconcileFleetAlertsQuietly,
  // Contribute this line to the enclosing declaration or statement.
  syncInsuranceInspectionCompliance,
  // Contribute this line to the enclosing declaration or statement.
  listCompliance,
  // Contribute this line to the enclosing declaration or statement.
  createCompliance,
  // Contribute this line to the enclosing declaration or statement.
  updateCompliance,
  // Contribute this line to the enclosing declaration or statement.
  deleteCompliance,
  // Contribute this line to the enclosing declaration or statement.
  openComplianceDocumentDownload,
};
