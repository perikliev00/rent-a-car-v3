/**
 * Admin pickup/return checklists, PDF download, and cancellation-request review.
 */
const checklistAdminService = require('../../../services/admin/checklistAdminService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Submit a pickup checklist with optional photos/signatures. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.submitPickupChecklist = asyncHandler(async (req, res, next) => {
  try {
    const data = await checklistAdminService.submitPickupChecklist(
      req,
      req.params.id,
      req.body
    );
    return apiResponse.success(res, data, 201);
  } catch (err) {
    if (err.code === 'INVALID_STATUS_TRANSITION') {
      return apiResponse.error(res, 'INVALID_STATUS_TRANSITION', err.message, 422);
    }
    if (err.code === 'REFUND_IN_PROGRESS') {
      return apiResponse.error(res, 'REFUND_IN_PROGRESS', err.message, 409);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.adminSubmitPickupChecklist',
      publicMessage: 'Error saving pickup checklist.',
    });
  }
});

/**
 * Submit a return checklist with optional photos/signatures. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.submitReturnChecklist = asyncHandler(async (req, res, next) => {
  try {
    const data = await checklistAdminService.submitReturnChecklist(
      req,
      req.params.id,
      req.body
    );
    return apiResponse.success(res, data, 201);
  } catch (err) {
    if (err.code === 'INVALID_STATUS_TRANSITION') {
      return apiResponse.error(res, 'INVALID_STATUS_TRANSITION', err.message, 422);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.adminSubmitReturnChecklist',
      publicMessage: 'Error saving return checklist.',
    });
  }
});

/**
 * Return checklists for a reservation. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getChecklists = asyncHandler(async (req, res, next) => {
  try {
    const data = await checklistAdminService.getChecklists(req.params.id);
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.adminGetChecklists',
      publicMessage: 'Error loading checklists.',
    });
  }
});

/**
 * Download an admin reservation PDF of the requested kind. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.downloadPdf = asyncHandler(async (req, res, next) => {
  try {
    const { buffer, filename, contentType } =
      await checklistAdminService.downloadReservationPdf(req.params.id, req.params.kind);
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(buffer);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.adminDownloadReservationPdf',
      publicMessage: 'Error generating PDF.',
    });
  }
});

/**
 * List pending cancellation requests. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listCancellationRequests = asyncHandler(async (req, res, next) => {
  try {
    const requests = await checklistAdminService.listCancellationRequests();
    return apiResponse.success(res, { requests });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.adminListCancellationRequests',
      publicMessage: 'Error loading cancellation requests.',
    });
  }
});

/**
 * Approve or reject a cancellation request. /
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.reviewCancellationRequest = asyncHandler(async (req, res, next) => {
  try {
    const approve = req.body.approve === true || req.body.approve === 'true';
    const data = await checklistAdminService.reviewCancellationRequest(req, req.params.id, {
      approve,
      adminNote: req.body.adminNote,
    });
    return apiResponse.success(res, data);
  } catch (err) {
    if (err.code === 'FORBIDDEN') {
      return apiResponse.error(res, 'FORBIDDEN', err.message, 403);
    }
    if (err.code === 'INVALID_STATUS_TRANSITION') {
      return apiResponse.error(res, 'INVALID_STATUS_TRANSITION', err.message, 422);
    }
    if (err.code === 'REFUND_IN_PROGRESS') {
      return apiResponse.error(res, 'REFUND_IN_PROGRESS', err.message, 409);
    }
    if (err.code === 'REFUND_FAILED') {
      return apiResponse.error(res, 'REFUND_FAILED', err.message, 502);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.adminReviewCancellationRequest',
      publicMessage: 'Error reviewing cancellation request.',
    });
  }
});
