/**
 * Admin car document list/upload/download/delete handlers.
 */
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
  cleanupUploads,
  // Contribute this line to the enclosing declaration or statement.
  notFoundOrForward,
// Continue the surrounding logic with this statement.
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
  // Start a try block for operations that may fail.
  try {
    // Create the documents constant.
    const documents = await carAdminService.listDocuments(req.params.id);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { documents });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (req.fileValidationError) {
      // Wait until the asynchronous operation resolves.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Create the user id constant.
    const userId = req.session?.user?.id ?? null;
    // Create the document constant.
    const document = await carAdminService.uploadDocument(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.file,
      // Contribute this line to the enclosing declaration or statement.
      req.body.name,
      // Reference the identifier used by the enclosing expression.
      userId
    );
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.uploaded_car_document',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: { documentId: document.id, name: document.name },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { document }, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await cleanupUploads(req);
    // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { stream, mimeType, filename } = await carAdminService.openDocumentDownload(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.params.docId
    );
    // Call res.setHeader to perform this step.
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    // Call res.setHeader to perform this step.
    res.setHeader(
      // Supply the literal value used by the enclosing expression.
      'Content-Disposition',
      // Continue the surrounding logic with this statement.
      `attachment; filename="${encodeURIComponent(filename || 'document')}"`
    );
    // Call stream.pipe to perform this step.
    stream.pipe(res);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await carAdminService.deleteDocument(req.params.id, req.params.docId);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { deleted: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return notFoundOrForward(err, req, res, next, 'api.deleteCarDocument', 'Error deleting document.');
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listDocuments,
  // Contribute this line to the enclosing declaration or statement.
  uploadDocument,
  // Contribute this line to the enclosing declaration or statement.
  downloadDocument,
  // Contribute this line to the enclosing declaration or statement.
  deleteDocument,
};
