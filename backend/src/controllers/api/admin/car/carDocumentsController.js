const carAdminService = require('../../../../services/admin/carAdminService');
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
const apiResponse = require('../../../../utils/apiResponse');
const asyncHandler = require('../../../../utils/asyncHandler');
const {
  cleanupUploads,
  notFoundOrForward,
} = require('./carControllerHelpers');

const listDocuments = asyncHandler(async (req, res, next) => {
  try {
    const documents = await carAdminService.listDocuments(req.params.id);
    return apiResponse.success(res, { documents });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarDocuments', 'Error loading documents.');
  }
});

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
  deleteDocument,
};
