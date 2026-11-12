/**
 * Admin car document vault: private storage uploads with legacy public-URL fallback
 * for older records still pointing at the public car-images bucket.
 */
const fs = require('fs');
// Require the 'path' module as path.
const path = require('path');
// Require the '../../../repositories/carRepository' module as carRepository.
const carRepository = require('../../../repositories/carRepository');
// Require the '../../sql/carDocumentSqlService' module as documentSql.
const documentSql = require('../../sql/carDocumentSqlService');
// Require the '../../storage/privateStorageService' module as privateStorage.
const privateStorage = require('../../storage/privateStorageService');
// Require the '../../storage' module as publicStorage.
const publicStorage = require('../../storage');
// Destructure object properties into local variables.
const { deleteManagedImageIfUnused } = require('./carAdminHelpers');
// Destructure object properties into local variables.
const { removeUploadedFile } = require('../../../middleware/fileUpload/uploadUtils');

/**
 * not found error.
 * @param {string} [message]
 * @returns {*}
 */
function notFoundError(message = 'Document not found') {
  // Create the err constant.
  const err = new Error(message);
  // Update err.code with the right-hand side value.
  err.code = 'NOT_FOUND';
  // Update err.status with the right-hand side value.
  err.status = 404;
  // Throw an error to stop the current control flow.
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

/** @param {number|string} carId */
async function listDocuments(carId) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  // Create the docs constant.
  const docs = await documentSql.listByCarId(carId);
  // Return the resulting value to the caller.
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
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');
  // Guard: early-return or throw when required input is missing/invalid.
  if (!file) throw new Error('Document file is required.');

  // Reserve the stored variable for later assignment.
  let stored;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in stored.
    stored = await privateStorage.storePrivateFile({
      // Provide the temp path field value.
      tempPath: file.path,
      // Provide the original name field value.
      originalName: file.originalname,
      // Provide the category field value.
      category: 'car-docs',
      // Provide the mime type field value.
      mimeType: file.mimetype,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await removeUploadedFile(file);
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Protected block: isolate failure modes.
  try {
    // Create the document constant.
    const document = await documentSql.create(carId, {
      // Provide the name field value.
      name: name || file.originalname || 'document',
      // Provide the storage key field value.
      storageKey: stored.storageKey,
      // Provide the original filename field value.
      originalFilename: file.originalname || 'document',
      // Provide the mime type field value.
      mimeType: stored.mimeType,
      // Provide the size bytes field value.
      sizeBytes: stored.sizeBytes,
      // Provide the uploaded by user id field value.
      uploadedByUserId: userId,
    });
    // Return the resulting value to the caller.
    return documentSql.toPublicDocument(document);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await privateStorage.deletePrivateFile(stored.storageKey);
    // Throw an error to stop the current control flow.
    throw err;
  }
}

/**
 * Remove DB row then delete private and/or legacy public storage objects.
 * @param {number|string} carId
 * @param {number|string} docId
 */
async function deleteDocument(carId, docId) {
  // Create the doc constant.
  const doc = await documentSql.remove(carId, docId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) throw new Error('Document not found');
  // Evaluate the condition and enter the branch when it is true.
  if (doc.storageKey) {
    // Wait until the asynchronous operation resolves.
    await privateStorage.deletePrivateFile(doc.storageKey);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (doc.legacyUrl) {
    // Wait until the asynchronous operation resolves.
    await deleteManagedImageIfUnused(doc.legacyUrl);
  }
  // Return the resulting value to the caller.
  return documentSql.toPublicDocument(doc);
}

/**
 * Open a download stream preferring private storageKey, then legacy public URL.
 * @param {number|string} carId
 * @param {number|string} docId
 */
async function openDocumentDownload(carId, docId) {
  // Create the car constant.
  const car = await carRepository.findByIdForAdmin(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!car || car.isDeleted) throw new Error('Car not found');

  // Create the doc constant.
  const doc = await documentSql.findById(carId, docId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) notFoundError();

  // Evaluate the condition and enter the branch when it is true.
  if (doc.storageKey) {
    // Create the opened constant.
    const opened = await privateStorage.openPrivateReadStream(doc.storageKey);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!opened) notFoundError('File is no longer available');
    // Return the resulting value to the caller.
    return {
      // Provide the document field value.
      document: doc,
      // Provide the stream field value.
      stream: opened.stream,
      // Provide the mime type field value.
      mimeType: doc.mimeType || 'application/octet-stream',
      // Provide the filename field value.
      filename: doc.originalFilename || doc.name || 'document',
    };
  }

  // Evaluate the condition and enter the branch when it is true.
  if (doc.legacyUrl) {
    // Create the opened constant.
    const opened = await openLegacyPublicReadStream(doc.legacyUrl);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!opened) notFoundError('File is no longer available');
    // Return the resulting value to the caller.
    return {
      // Provide the document field value.
      document: doc,
      // Provide the stream field value.
      stream: opened.stream,
      // Provide the mime type field value.
      mimeType: opened.mimeType || doc.mimeType || 'application/octet-stream',
      // Provide the filename field value.
      filename: doc.originalFilename || doc.name || 'document',
    };
  }

  // Call notFoundError to perform this step.
  notFoundError('File is no longer available');
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listDocuments,
  // Contribute this line to the enclosing declaration or statement.
  uploadDocument,
  // Contribute this line to the enclosing declaration or statement.
  deleteDocument,
  // Contribute this line to the enclosing declaration or statement.
  openDocumentDownload,
};
