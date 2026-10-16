/**
 * Admin car document vault: private storage uploads with legacy public-URL fallback
 * for older records still pointing at the public car-images bucket.
 */
const fs = require('fs');
const path = require('path');
const carRepository = require('../../../repositories/carRepository');
const documentSql = require('../../sql/carDocumentSqlService');
const privateStorage = require('../../storage/privateStorageService');
const publicStorage = require('../../storage');
const { deleteManagedImageIfUnused } = require('./carAdminHelpers');
const { removeUploadedFile } = require('../../../middleware/fileUpload/uploadUtils');

/**
 * not found error.
 * @param {string} [message]
 * @returns {*}
 */
function notFoundError(message = 'Document not found') {
  const err = new Error(message);
  err.code = 'NOT_FOUND';
  err.status = 404;
  throw err;
}

/**
 * Open a read stream for documents stored under the old public URL scheme.
 * Path traversal is blocked by resolving under PUBLIC_CAR_IMAGES_DIR.
 * @param {string} legacyUrl
 */
async function openLegacyPublicReadStream(legacyUrl) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!legacyUrl || !publicStorage.isManagedPublicUrl(legacyUrl)) {
    return null;
  }

  if (typeof publicStorage.openManagedPublicReadStream === 'function') {
    return publicStorage.openManagedPublicReadStream(legacyUrl);
  }

  if (publicStorage.driver === 'local' && publicStorage.PUBLIC_CAR_IMAGES_DIR) {
    const filename = path.basename(legacyUrl);
    const filePath = path.resolve(publicStorage.PUBLIC_CAR_IMAGES_DIR, filename);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!filePath.startsWith(path.resolve(publicStorage.PUBLIC_CAR_IMAGES_DIR))) {
      return null;
    }
    // Protected block: isolate failure modes.
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

/** @param {number|string} carId */
async function listDocuments(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  const docs = await documentSql.listByCarId(carId);
  return docs.map(documentSql.toPublicDocument);
}

/**
 * Store file in private storage then insert the document row; rolls back storage on DB failure.
 * @param {number|string} carId
 * @param {object} file
 * @param {string} [name]
 * @param {number|null} [userId]
 */
async function uploadDocument(carId, file, name, userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  // Guard: early-return or throw when required input is missing/invalid.
  if (!file) throw new Error('Document file is required.');

  let stored;
  // Protected block: isolate failure modes.
  try {
    stored = await privateStorage.storePrivateFile({
      tempPath: file.path,
      originalName: file.originalname,
      category: 'car-docs',
      mimeType: file.mimetype,
    });
  } catch (err) {
    await removeUploadedFile(file);
    throw err;
  }

  // Protected block: isolate failure modes.
  try {
    const document = await documentSql.create(carId, {
      name: name || file.originalname || 'document',
      storageKey: stored.storageKey,
      originalFilename: file.originalname || 'document',
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
      uploadedByUserId: userId,
    });
    return documentSql.toPublicDocument(document);
  } catch (err) {
    await privateStorage.deletePrivateFile(stored.storageKey);
    throw err;
  }
}

/**
 * Remove DB row then delete private and/or legacy public storage objects.
 * @param {number|string} carId
 * @param {number|string} docId
 */
async function deleteDocument(carId, docId) {
  const doc = await documentSql.remove(carId, docId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) throw new Error('Document not found');
  if (doc.storageKey) {
    await privateStorage.deletePrivateFile(doc.storageKey);
  }
  if (doc.legacyUrl) {
    await deleteManagedImageIfUnused(doc.legacyUrl);
  }
  return documentSql.toPublicDocument(doc);
}

/**
 * Open a download stream preferring private storageKey, then legacy public URL.
 * @param {number|string} carId
 * @param {number|string} docId
 */
async function openDocumentDownload(carId, docId) {
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');

  const doc = await documentSql.findById(carId, docId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) notFoundError();

  if (doc.storageKey) {
    const opened = await privateStorage.openPrivateReadStream(doc.storageKey);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!opened) notFoundError('File is no longer available');
    return {
      document: doc,
      stream: opened.stream,
      mimeType: doc.mimeType || 'application/octet-stream',
      filename: doc.originalFilename || doc.name || 'document',
    };
  }

  if (doc.legacyUrl) {
    const opened = await openLegacyPublicReadStream(doc.legacyUrl);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!opened) notFoundError('File is no longer available');
    return {
      document: doc,
      stream: opened.stream,
      mimeType: opened.mimeType || doc.mimeType || 'application/octet-stream',
      filename: doc.originalFilename || doc.name || 'document',
    };
  }

  notFoundError('File is no longer available');
}

module.exports = {
  listDocuments,
  uploadDocument,
  deleteDocument,
  openDocumentDownload,
};
