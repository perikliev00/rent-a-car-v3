/**
 * Admin car damage report list/create/resolve/delete handlers.
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
 * List damage reports for a car.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req - Params: id (car id)
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const listDamageReports = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the reports constant.
    const reports = await carAdminService.listDamageReports(req.params.id);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { reports });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return notFoundOrForward(err, req, res, next, 'api.listCarDamageReports', 'Error loading damage reports.');
  }
});

/**
 * Create a damage report with optional photos.
 * Side effects: persists photos + report; audits; cleans temps on validation/service failure.
 * @param {import('express').Request} req - Params: id; body + `req.files` photos
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const createDamageReport = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (req.fileValidationError) {
      // Wait until the asynchronous operation resolves.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Create the errors constant.
    const errors = validationResult(req);
    // Evaluate the condition and enter the branch when it is true.
    if (!errors.isEmpty()) {
      // Wait until the asynchronous operation resolves.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return validationErrorResponse(res, errors);
    }

    // Create the user id constant.
    const userId = req.session?.user?.id ?? null;
    // Create the report constant.
    const report = await carAdminService.createDamageReport(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.body,
      // Contribute this line to the enclosing declaration or statement.
      req.files || [],
      // Reference the identifier used by the enclosing expression.
      userId
    );
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.created_car_damage_report',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: { reportId: report.id },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { report }, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await cleanupUploads(req);
    // Return the resulting value to the caller.
    return notFoundOrForward(err, req, res, next, 'api.createCarDamageReport', 'Error creating damage report.');
  }
});

/**
 * Mark a damage report as resolved and audit the action.
 * Side effects: updates report status; writes admin audit log.
 * @param {import('express').Request} req - Params: id, reportId
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const resolveDamageReport = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the report constant.
    const report = await carAdminService.resolveDamageReport(req.params.id, req.params.reportId);
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.resolved_car_damage_report',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: { reportId: report.id },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { report });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return notFoundOrForward(err, req, res, next, 'api.resolveCarDamageReport', 'Error resolving damage report.');
  }
});

/**
 * Delete a damage report.
 * Side effects: deletes report (and associated photos per service rules).
 * @param {import('express').Request} req - Params: id, reportId
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const deleteDamageReport = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await carAdminService.deleteDamageReport(req.params.id, req.params.reportId);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { deleted: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return notFoundOrForward(err, req, res, next, 'api.deleteCarDamageReport', 'Error deleting damage report.');
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listDamageReports,
  // Contribute this line to the enclosing declaration or statement.
  createDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  resolveDamageReport,
  // Contribute this line to the enclosing declaration or statement.
  deleteDamageReport,
};
