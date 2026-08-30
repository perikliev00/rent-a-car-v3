const carRepository = require('../../../repositories/carRepository');
const documentSql = require('../../sql/carDocumentSqlService');
const { buildImagePath, deleteManagedImageIfUnused } = require('./carAdminHelpers');

async function listDocuments(carId) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  return documentSql.listByCarId(carId);
}

async function uploadDocument(carId, file, name, userId = null) {
  const car = await carRepository.findByIdForAdmin(carId);
  if (!car || car.isDeleted) throw new Error('Car not found');
  if (!file) throw new Error('Document image is required.');

  const url = buildImagePath(file);
  return documentSql.create(carId, {
    name: name || file.originalname || 'document',
    url,
    uploadedByUserId: userId,
  });
}

async function deleteDocument(carId, docId) {
  const doc = await documentSql.remove(carId, docId);
  if (!doc) throw new Error('Document not found');
  await deleteManagedImageIfUnused(doc.url);
  return doc;
}

module.exports = {
  listDocuments,
  uploadDocument,
  deleteDocument,
};
