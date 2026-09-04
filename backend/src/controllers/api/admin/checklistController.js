const checklistAdminService = require('../../../services/admin/checklistAdminService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

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
