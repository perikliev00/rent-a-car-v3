const { validationResult } = require('express-validator');
const carAdminService = require('../../../../services/admin/carAdminService');
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
const apiResponse = require('../../../../utils/apiResponse');
const asyncHandler = require('../../../../utils/asyncHandler');
const {
  validationErrorResponse,
  cleanupUploads,
  notFoundOrForward,
} = require('./carControllerHelpers');

const listCompliance = asyncHandler(async (req, res, next) => {
  try {
    const items = await carAdminService.listCompliance(req.params.id);
    return apiResponse.success(res, { items });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarCompliance', 'Error loading compliance items.');
  }
});

const createCompliance = asyncHandler(async (req, res, next) => {
  try {
    if (req.fileValidationError) {
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await cleanupUploads(req);
      return validationErrorResponse(res, errors);
    }

    const userId = req.session?.user?.id ?? null;
    const item = await carAdminService.createCompliance(
      req.params.id,
      req.body,
      req.file || null,
      userId
    );
    await logAdminAction(req, {
      action: 'admin.created_car_compliance_item',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { itemId: item.id, itemType: item.itemType },
    });
    return apiResponse.success(res, { item }, 201);
  } catch (err) {
    await cleanupUploads(req);
    return notFoundOrForward(err, req, res, next, 'api.createCarCompliance', 'Error creating compliance item.');
  }
});

const updateCompliance = asyncHandler(async (req, res, next) => {
  try {
    if (req.fileValidationError) {
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await cleanupUploads(req);
      return validationErrorResponse(res, errors);
    }

    const item = await carAdminService.updateCompliance(
      req.params.id,
      req.params.itemId,
      req.body,
      req.file || null
    );
    await logAdminAction(req, {
      action: 'admin.updated_car_compliance_item',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { itemId: item.id, itemType: item.itemType },
    });
    return apiResponse.success(res, { item });
  } catch (err) {
    await cleanupUploads(req);
    return notFoundOrForward(err, req, res, next, 'api.updateCarCompliance', 'Error updating compliance item.');
  }
});

const deleteCompliance = asyncHandler(async (req, res, next) => {
  try {
    await carAdminService.deleteCompliance(req.params.id, req.params.itemId);
    await logAdminAction(req, {
      action: 'admin.deleted_car_compliance_item',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { itemId: Number(req.params.itemId) },
    });
    return apiResponse.success(res, { deleted: true });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.deleteCarCompliance', 'Error deleting compliance item.');
  }
});

const downloadComplianceDocument = asyncHandler(async (req, res, next) => {
  try {
    const { stream, mimeType, filename } = await carAdminService.openComplianceDocumentDownload(
      req.params.id,
      req.params.itemId
    );
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(filename || 'compliance-document')}"`
    );
    stream.pipe(res);
  } catch (err) {
    return notFoundOrForward(
      err,
      req,
      res,
      next,
      'api.downloadCarComplianceDocument',
      'Error downloading compliance document.'
    );
  }
});

module.exports = {
  listCompliance,
  createCompliance,
  updateCompliance,
  deleteCompliance,
  downloadComplianceDocument,
};
