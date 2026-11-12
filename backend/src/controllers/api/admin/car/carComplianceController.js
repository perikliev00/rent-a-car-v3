/**
 * Admin car compliance item CRUD and document download handlers.
 */
const { validationResult } = require('express-validator');
// Require the '../../../../services/admin/carAdminService' module as carAdminService.
const carAdminService = require('../../../../services/admin/carAdminService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
// Require the '../../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../../utils/apiResponse');
// Require the '../../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../../utils/asyncHandler');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  validationErrorResponse,
  // Contribute this line to the enclosing declaration or statement.
  cleanupUploads,
  // Contribute this line to the enclosing declaration or statement.
  notFoundOrForward,
// Continue the surrounding logic with this statement.
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
  // Start a try block for operations that may fail.
  try {
    // Create the items constant.
    const items = await carAdminService.listCompliance(req.params.id);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { items });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Multer/content validation soft-failed earlier in the chain.
    if (req.fileValidationError) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return validationErrorResponse(res, errors);
    }

    // Create the user id constant.
    const userId = req.session?.user?.id ?? null;
    // Create the item constant.
    const item = await carAdminService.createCompliance(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.body,
      // Contribute this line to the enclosing declaration or statement.
      req.file || null,
      // Reference the identifier used by the enclosing expression.
      userId
    );
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.created_car_compliance_item',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: { itemId: item.id, itemType: item.itemType },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { item }, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Drop temp uploads so failed requests leave no orphans.
    await cleanupUploads(req);
    // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Multer/content validation soft-failed earlier in the chain.
    if (req.fileValidationError) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return validationErrorResponse(res, errors);
    }

    // Create the item constant.
    const item = await carAdminService.updateCompliance(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.params.itemId,
      // Contribute this line to the enclosing declaration or statement.
      req.body,
      // Contribute this line to the enclosing declaration or statement.
      req.file || null
    );
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.updated_car_compliance_item',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: { itemId: item.id, itemType: item.itemType },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { item });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Drop temp uploads so failed requests leave no orphans.
    await cleanupUploads(req);
    // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await carAdminService.deleteCompliance(req.params.id, req.params.itemId);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.deleted_car_compliance_item',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: { itemId: Number(req.params.itemId) },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { deleted: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { stream, mimeType, filename } = await carAdminService.openComplianceDocumentDownload(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.params.itemId
    );
    // Call res.setHeader to perform this step.
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    // Call res.setHeader to perform this step.
    res.setHeader(
      // Supply the literal value used by the enclosing expression.
      'Content-Disposition',
      // Continue the surrounding logic with this statement.
      `attachment; filename="${encodeURIComponent(filename || 'compliance-document')}"`
    );
    // Call stream.pipe to perform this step.
    stream.pipe(res);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return notFoundOrForward(
      // Contribute this line to the enclosing declaration or statement.
      err,
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Contribute this line to the enclosing declaration or statement.
      res,
      // Contribute this line to the enclosing declaration or statement.
      next,
      // Supply the literal value used by the enclosing expression.
      'api.downloadCarComplianceDocument',
      // Supply the literal value used by the enclosing expression.
      'Error downloading compliance document.'
    );
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listCompliance,
  // Contribute this line to the enclosing declaration or statement.
  createCompliance,
  // Contribute this line to the enclosing declaration or statement.
  updateCompliance,
  // Contribute this line to the enclosing declaration or statement.
  deleteCompliance,
  // Contribute this line to the enclosing declaration or statement.
  downloadComplianceDocument,
};
