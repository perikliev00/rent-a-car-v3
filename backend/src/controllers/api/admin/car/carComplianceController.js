/**
 * Admin car compliance item CRUD and document download handlers.
 */
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

/**
 * List compliance items for a car.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const listCompliance = asyncHandler(async (req, res, next) => {
  try {
    const items = await carAdminService.listCompliance(req.params.id);
    return apiResponse.success(res, { items });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarCompliance', 'Error loading compliance items.');
  }
});

/**
 * Create a compliance item (optional document upload).
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const createCompliance = asyncHandler(async (req, res, next) => {
  try {
    // Multer/content validation soft-failed earlier in the chain.
    if (req.fileValidationError) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Drop temp uploads so failed requests leave no orphans.
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
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'admin.created_car_compliance_item',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { itemId: item.id, itemType: item.itemType },
    });
    return apiResponse.success(res, { item }, 201);
  } catch (err) {
    // Drop temp uploads so failed requests leave no orphans.
    await cleanupUploads(req);
    return notFoundOrForward(err, req, res, next, 'api.createCarCompliance', 'Error creating compliance item.');
  }
});

/**
 * Update a compliance item (optional document upload).
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const updateCompliance = asyncHandler(async (req, res, next) => {
  try {
    // Multer/content validation soft-failed earlier in the chain.
    if (req.fileValidationError) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      return validationErrorResponse(res, errors);
    }

    const item = await carAdminService.updateCompliance(
      req.params.id,
      req.params.itemId,
      req.body,
      req.file || null
    );
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'admin.updated_car_compliance_item',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { itemId: item.id, itemType: item.itemType },
    });
    return apiResponse.success(res, { item });
  } catch (err) {
    // Drop temp uploads so failed requests leave no orphans.
    await cleanupUploads(req);
    return notFoundOrForward(err, req, res, next, 'api.updateCarCompliance', 'Error updating compliance item.');
  }
});

/**
 * Delete a compliance item.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const deleteCompliance = asyncHandler(async (req, res, next) => {
  try {
    await carAdminService.deleteCompliance(req.params.id, req.params.itemId);
    // Record an admin audit entry for this mutation.
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

/**
 * Download the document attached to a compliance item.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
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
