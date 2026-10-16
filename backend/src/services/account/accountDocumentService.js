/**
 * Customer document uploads (license, passport, etc.) stored in private storage.
 * Upsert replaces prior doc of the same type and cleans up the old storage key.
 * Downloads enforce ownership unless admin=true.
 */
const documentSql = require('../sql/customerDocumentSqlService');
const reservationSql = require('../sql/reservationSqlService');
const privateStorage = require('../storage/privateStorageService');
const { removeUploadedFile } = require('../../middleware/fileUpload/uploadUtils');

const ALLOWED_DOC_TYPES = new Set(['driver_license', 'passport_id', 'other']);

/**
 * Strip storage keys and internal fields from API responses.
 * @param {object|null} doc
 * @returns {object|null}
 */
function toPublicDocument(doc) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) return null;
  return {
    id: doc.id,
    docType: doc.docType,
    originalFilename: doc.originalFilename,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    reservationId: doc.reservationId,
    createdAt: doc.createdAt,
  };
}

/**
 * @param {string|number} userId
 * @returns {Promise<object[]>}
 */
async function listDocuments(userId) {
  const docs = await documentSql.listByUserId(userId);
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
    const err = new Error('A file is required.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    await removeUploadedFile(file);
    const err = new Error('Invalid document type.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  let linkedReservationId = null;
  if (reservationId != null && String(reservationId).trim() !== '') {
    // Only allow linking documents to reservations the user owns.
    const owned = await reservationSql.findByIdForUser(reservationId, userId);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!owned) {
      await removeUploadedFile(file);
      const err = new Error('Reservation not found.');
      err.code = 'VALIDATION_ERROR';
      err.status = 422;
      throw err;
    }
    linkedReservationId = owned.id;
  }

  let stored;
  // Protected block: isolate failure modes.
  try {
    stored = await privateStorage.storePrivateFile({
      tempPath: file.path,
      originalName: file.originalname,
      category: 'customer-docs',
      mimeType: file.mimetype,
    });
  } catch (err) {
    await removeUploadedFile(file);
    throw err;
  }

  const previous = await documentSql.listByUserId(userId);
  const previousSameType = previous.find((d) => d.docType === docType);

  let document;
  let replaced;
  // Protected block: isolate failure modes.
  try {
    ({ document, replaced } = await documentSql.upsert({
      userId,
      reservationId: linkedReservationId,
      docType,
      storageKey: stored.storageKey,
      originalFilename: file.originalname || 'document',
      mimeType: stored.mimeType,
      sizeBytes: stored.sizeBytes,
    }));
  } catch (err) {
    await privateStorage.deletePrivateFile(stored.storageKey);
    throw err;
  }

  // Delete previous object only after successful upsert with a different key.
  if (replaced && previousSameType && previousSameType.storageKey !== stored.storageKey) {
    await privateStorage.deletePrivateFile(previousSameType.storageKey);
  }

  return toPublicDocument(document);
}

/**
 * @param {string|number} userId
 * @param {string|number} docId
 * @returns {Promise<object>}
 */
async function deleteDocument(userId, docId) {
  const doc = await documentSql.remove(docId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) {
    const err = new Error('Document not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  await privateStorage.deletePrivateFile(doc.storageKey);
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
  const doc = admin
    ? await documentSql.findById(docId)
    : await documentSql.findByIdForUser(docId, userId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!doc) {
    const err = new Error('Document not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  // Guard: early-return or throw when required input is missing/invalid.
  if (!admin && String(doc.userId) !== String(userId)) {
    const err = new Error('Document not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const opened = await privateStorage.openPrivateReadStream(doc.storageKey);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!opened) {
    const err = new Error('File is no longer available');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  return {
    document: doc,
    stream: opened.stream,
  };
}

module.exports = {
  listDocuments,
  uploadDocument,
  deleteDocument,
  openDocumentDownload,
  toPublicDocument,
  ALLOWED_DOC_TYPES,
};
