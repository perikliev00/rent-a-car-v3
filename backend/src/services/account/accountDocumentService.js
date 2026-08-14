const documentSql = require('../sql/customerDocumentSqlService');
const reservationSql = require('../sql/reservationSqlService');
const privateStorage = require('../storage/privateStorageService');
const { removeUploadedFile } = require('../../middleware/fileUpload/uploadUtils');

const ALLOWED_DOC_TYPES = new Set(['driver_license', 'passport_id', 'other']);

function toPublicDocument(doc) {
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

async function listDocuments(userId) {
  const docs = await documentSql.listByUserId(userId);
  return docs.map(toPublicDocument);
}

async function uploadDocument(userId, { file, docType, reservationId }) {
  if (!file) {
    const err = new Error('A file is required.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }
  if (!ALLOWED_DOC_TYPES.has(docType)) {
    await removeUploadedFile(file);
    const err = new Error('Invalid document type.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  let linkedReservationId = null;
  if (reservationId != null && String(reservationId).trim() !== '') {
    const owned = await reservationSql.findByIdForUser(reservationId, userId);
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

  if (replaced && previousSameType && previousSameType.storageKey !== stored.storageKey) {
    await privateStorage.deletePrivateFile(previousSameType.storageKey);
  }

  return toPublicDocument(document);
}

async function deleteDocument(userId, docId) {
  const doc = await documentSql.remove(docId, userId);
  if (!doc) {
    const err = new Error('Document not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  await privateStorage.deletePrivateFile(doc.storageKey);
  return toPublicDocument(doc);
}

async function openDocumentDownload(userId, docId, { admin = false } = {}) {
  const doc = admin
    ? await documentSql.findById(docId)
    : await documentSql.findByIdForUser(docId, userId);
  if (!doc) {
    const err = new Error('Document not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  if (!admin && String(doc.userId) !== String(userId)) {
    const err = new Error('Document not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  const opened = await privateStorage.openPrivateReadStream(doc.storageKey);
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
