/**
 * Admin car damage report list/create/resolve/delete handlers.
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
 * List damage reports for a car.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req - Params: id (car id)
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const listDamageReports = asyncHandler(async (req, res, next) => {
  try {
    const reports = await carAdminService.listDamageReports(req.params.id);
    return apiResponse.success(res, { reports });
  } catch (err) {
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
    const report = await carAdminService.createDamageReport(
      req.params.id,
      req.body,
      req.files || [],
      userId
    );
    await logAdminAction(req, {
      action: 'admin.created_car_damage_report',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { reportId: report.id },
    });
    return apiResponse.success(res, { report }, 201);
  } catch (err) {
    await cleanupUploads(req);
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
  try {
    const report = await carAdminService.resolveDamageReport(req.params.id, req.params.reportId);
    await logAdminAction(req, {
      action: 'admin.resolved_car_damage_report',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { reportId: report.id },
    });
    return apiResponse.success(res, { report });
  } catch (err) {
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
  try {
    await carAdminService.deleteDamageReport(req.params.id, req.params.reportId);
    return apiResponse.success(res, { deleted: true });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.deleteCarDamageReport', 'Error deleting damage report.');
  }
});

module.exports = {
  listDamageReports,
  createDamageReport,
  resolveDamageReport,
  deleteDamageReport,
};
