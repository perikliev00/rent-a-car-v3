/**
 * Admin pickup/return checklists, PDF download, and cancellation-request review.
 */
const checklistAdminService = require('../../../services/admin/checklistAdminService');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
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
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await checklistAdminService.submitPickupChecklist(
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.body
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, data, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'INVALID_STATUS_TRANSITION') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'INVALID_STATUS_TRANSITION', err.message, 422);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'REFUND_IN_PROGRESS') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'REFUND_IN_PROGRESS', err.message, 409);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.adminSubmitPickupChecklist',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await checklistAdminService.submitReturnChecklist(
      // Contribute this line to the enclosing declaration or statement.
      req,
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.body
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, data, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'INVALID_STATUS_TRANSITION') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'INVALID_STATUS_TRANSITION', err.message, 422);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.adminSubmitReturnChecklist',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await checklistAdminService.getChecklists(req.params.id);
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.adminGetChecklists',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { buffer, filename, contentType } =
      // Wait until the asynchronous operation resolves.
      await checklistAdminService.downloadReservationPdf(req.params.id, req.params.kind);
    // Call res.setHeader to perform this step.
    res.setHeader('Content-Type', contentType);
    // Call res.setHeader to perform this step.
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    // Return the resulting value to the caller.
    return res.send(buffer);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.adminDownloadReservationPdf',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the requests constant.
    const requests = await checklistAdminService.listCancellationRequests();
    // Return the resulting value to the caller.
    return apiResponse.success(res, { requests });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.adminListCancellationRequests',
      // Provide the public message field value.
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
  // Start a try block for operations that may fail.
  try {
    // Create the approve constant.
    const approve = req.body.approve === true || req.body.approve === 'true';
    // Create the data constant.
    const data = await checklistAdminService.reviewCancellationRequest(req, req.params.id, {
      // Contribute this line to the enclosing declaration or statement.
      approve,
      // Provide the admin note field value.
      adminNote: req.body.adminNote,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'FORBIDDEN') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'FORBIDDEN', err.message, 403);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'INVALID_STATUS_TRANSITION') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'INVALID_STATUS_TRANSITION', err.message, 422);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'REFUND_IN_PROGRESS') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'REFUND_IN_PROGRESS', err.message, 409);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'REFUND_FAILED') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'REFUND_FAILED', err.message, 502);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.adminReviewCancellationRequest',
      // Provide the public message field value.
      publicMessage: 'Error reviewing cancellation request.',
    });
  }
});
