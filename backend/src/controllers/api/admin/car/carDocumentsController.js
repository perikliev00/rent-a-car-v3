/**
 * Admin car document list/upload/download/delete handlers.
 */
const carAdminService = require('../../../../services/admin/carAdminService');
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
const apiResponse = require('../../../../utils/apiResponse');
const asyncHandler = require('../../../../utils/asyncHandler');
const {
  cleanupUploads,
  notFoundOrForward,
} = require('./carControllerHelpers');

/**
 * List private documents attached to a car.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req - Params: id (car id)
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const listDocuments = asyncHandler(async (req, res, next) => {
  try {
    const documents = await carAdminService.listDocuments(req.params.id);
    return apiResponse.success(res, { documents });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarDocuments', 'Error loading documents.');
  }
});

/**
 * Upload a private document for a car.
 * Side effects: persists upload, inserts document row, audits; cleans temp on failure.
 * @param {import('express').Request} req - Params: id; file + body.name
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const uploadDocument = asyncHandler(async (req, res, next) => {
  try {
    if (req.fileValidationError) {
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    const userId = req.session?.user?.id ?? null;
    const document = await carAdminService.uploadDocument(
      req.params.id,
      req.file,
      req.body.name,
      userId
    );
    await logAdminAction(req, {
      action: 'admin.uploaded_car_document',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { documentId: document.id, name: document.name },
    });
    return apiResponse.success(res, { document }, 201);
  } catch (err) {
    await cleanupUploads(req);
    return notFoundOrForward(err, req, res, next, 'api.uploadCarDocument', 'Error uploading document.');
  }
});

/**
 * Stream a document download by id.
 * Side effects: opens a storage stream and pipes it to the response.
 * @param {import('express').Request} req - Params: id, docId
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<void>}
 */
const downloadDocument = asyncHandler(async (req, res, next) => {
  try {
    const { stream, mimeType, filename } = await carAdminService.openDocumentDownload(
      req.params.id,
      req.params.docId
    );
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename || 'document')}"`
    );
    stream.pipe(res);
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.downloadCarDocument', 'Error downloading document.');
  }
});

/**
 * Delete a document by id.
 * Side effects: removes storage object and document row.
 * @param {import('express').Request} req - Params: id, docId
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const deleteDocument = asyncHandler(async (req, res, next) => {
  try {
    await carAdminService.deleteDocument(req.params.id, req.params.docId);
    return apiResponse.success(res, { deleted: true });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.deleteCarDocument', 'Error deleting document.');
  }
});

module.exports = {
  listDocuments,
  uploadDocument,
  downloadDocument,
  deleteDocument,
};
