/**
 * Customer document uploads (license, passport, etc.) stored in private storage.
 * Upsert replaces prior doc of the same type and cleans up the old storage key.
 * Downloads enforce ownership unless admin=true.
 */
const documentSql = require('../sql/customerDocumentSqlService');
// Require the '../sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../sql/reservationSqlService');
// Require the '../storage/privateStorageService' module as privateStorage.
const privateStorage = require('../storage/privateStorageService');
// Destructure object properties into local variables.
const { removeUploadedFile } = require('../../middleware/fileUpload/uploadUtils');

// Create the allowed doc types constant.
const ALLOWED_DOC_TYPES = new Set(['driver_license', 'passport_id', 'other']);

/**
 * Strip storage keys and internal fields from API responses.
 * @param {object|null} doc
 * @returns {object|null}
 */
function toPublicDocument(doc) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: doc.id,
    // Provide the doc type field value.
    docType: doc.docType,
    // Provide the original filename field value.
    originalFilename: doc.originalFilename,
    // Provide the mime type field value.
    mimeType: doc.mimeType,
    // Provide the size bytes field value.
    sizeBytes: doc.sizeBytes,
    // Provide the reservation id field value.
    reservationId: doc.reservationId,
    // Provide the created at field value.
    createdAt: doc.createdAt,
  };
}

/**
 * @param {string|number} userId
 * @returns {Promise<object[]>}
 */
async function listDocuments(userId) {
  // Create the docs constant.
  const docs = await documentSql.listByUserId(userId);
  // Return the resulting value to the caller.
  return docs.map(toPublicDocument);
}

/**
 * Store an uploaded file privately and upsert the document row.
 * Cleans temp/storage on validation or DB failure.
 *
 * @param {string|number} userId
 * @param {{ file: object, docType: string, reservationId?: string|number }} params
 * @returns {Promise<object>}
 */
async function uploadDocument(userId, { file, docType, reservationId }) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!file) {
    // Create the err constant.
    const err = new Error('A file is required.');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    // Wait until the asynchronous operation resolves.
    await removeUploadedFile(file);
    // Create the err constant.
    const err = new Error('Invalid document type.');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Initialize the mutable linked reservation id variable.
  let linkedReservationId = null;
  // Evaluate the condition and enter the branch when it is true.
  if (reservationId != null && String(reservationId).trim() !== '') {
    // Only allow linking documents to reservations the user owns.
    const owned = await reservationSql.findByIdForUser(reservationId, userId);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!owned) {
      // Wait until the asynchronous operation resolves.
      await removeUploadedFile(file);
      // Create the err constant.
      const err = new Error('Reservation not found.');
      // Update err.code with the right-hand side value.
      err.code = 'VALIDATION_ERROR';
      // Update err.status with the right-hand side value.
      err.status = 422;
      // Throw an error to stop the current control flow.
      throw err;
    }
    // Update linkedReservationId with the right-hand side value.
    linkedReservationId = owned.id;
  }

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
      category: 'customer-docs',
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

  // Create the previous constant.
  const previous = await documentSql.listByUserId(userId);
  // Create the previous same type constant.
  const previousSameType = previous.find((d) => d.docType === docType);

  // Reserve the document variable for later assignment.
  let document;
  // Reserve the replaced variable for later assignment.
  let replaced;
  // Protected block: isolate failure modes.
  try {
    // Continue the surrounding logic with this statement.
    ({ document, replaced } = await documentSql.upsert({
      // Contribute this line to the enclosing declaration or statement.
      userId,
      // Provide the reservation id field value.
      reservationId: linkedReservationId,
      // Contribute this line to the enclosing declaration or statement.
      docType,
      // Provide the storage key field value.
      storageKey: stored.storageKey,
      // Provide the original filename field value.
      originalFilename: file.originalname || 'document',
      // Provide the mime type field value.
      mimeType: stored.mimeType,
      // Provide the size bytes field value.
      sizeBytes: stored.sizeBytes,
    }));
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await privateStorage.deletePrivateFile(stored.storageKey);
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Delete previous object only after successful upsert with a different key.
  if (replaced && previousSameType && previousSameType.storageKey !== stored.storageKey) {
    // Wait until the asynchronous operation resolves.
    await privateStorage.deletePrivateFile(previousSameType.storageKey);
  }

  // Return the resulting value to the caller.
  return toPublicDocument(document);
}

/**
 * @param {string|number} userId
 * @param {string|number} docId
 * @returns {Promise<object>}
 */
async function deleteDocument(userId, docId) {
  // Create the doc constant.
  const doc = await documentSql.remove(docId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) {
    // Create the err constant.
    const err = new Error('Document not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Wait until the asynchronous operation resolves.
  await privateStorage.deletePrivateFile(doc.storageKey);
  // Return the resulting value to the caller.
  return toPublicDocument(doc);
}

/**
 * Open a readable stream for download; 404 for missing ownership (no existence leak).
 *
 * @param {string|number} userId
 * @param {string|number} docId
 * @param {{ admin?: boolean }} [options]
 * @returns {Promise<{ document: object, stream: import('stream').Readable }>}
 */
async function openDocumentDownload(userId, docId, { admin = false } = {}) {
  // Create the doc constant.
  const doc = admin
    // Continue the surrounding logic with this statement.
    ? await documentSql.findById(docId)
    // Continue the surrounding logic with this statement.
    : await documentSql.findByIdForUser(docId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) {
    // Create the err constant.
    const err = new Error('Document not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!admin && String(doc.userId) !== String(userId)) {
    // Create the err constant.
    const err = new Error('Document not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the opened constant.
  const opened = await privateStorage.openPrivateReadStream(doc.storageKey);
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
    // Provide the document field value.
    document: doc,
    // Provide the stream field value.
    stream: opened.stream,
  };
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
  // Contribute this line to the enclosing declaration or statement.
  toPublicDocument,
  // Contribute this line to the enclosing declaration or statement.
  ALLOWED_DOC_TYPES,
};
