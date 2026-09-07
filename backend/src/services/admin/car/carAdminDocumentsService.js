const fs = require('fs');
const path = require('path');
const carRepository = require('../../../repositories/carRepository');
const documentSql = require('../../sql/carDocumentSqlService');
const privateStorage = require('../../storage/privateStorageService');
const publicStorage = require('../../storage');
const { deleteManagedImageIfUnused } = require('./carAdminHelpers');
const { removeUploadedFile } = require('../../../middleware/fileUpload/uploadUtils');

function notFoundError(message = 'Document not found') {
  const err = new Error(message);
  err.code = 'NOT_FOUND';
  err.status = 404;
  throw err;
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

async function listDocuments(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  const docs = await documentSql.listByCarId(carId);
  return docs.map(documentSql.toPublicDocument);
}

async function uploadDocument(carId, file, name, userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  if (!file) throw new Error('Document file is required.');

  let stored;
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

async function deleteDocument(carId, docId) {
  const doc = await documentSql.remove(carId, docId);
  if (!doc) throw new Error('Document not found');
  if (doc.storageKey) {
    await privateStorage.deletePrivateFile(doc.storageKey);
  }
  if (doc.legacyUrl) {
    await deleteManagedImageIfUnused(doc.legacyUrl);
  }
  return documentSql.toPublicDocument(doc);
}

async function openDocumentDownload(carId, docId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');

  const doc = await documentSql.findById(carId, docId);
  if (!doc) notFoundError();

  if (doc.storageKey) {
    const opened = await privateStorage.openPrivateReadStream(doc.storageKey);
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
