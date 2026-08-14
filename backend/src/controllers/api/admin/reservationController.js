const { validationResult } = require('express-validator');
const {
  changeReservationStatus,
  getReservationDetail,
} = require('../../../services/admin/reservationAdminService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

function validationErrorResponse(res, errors) {
  return apiResponse.error(
    res,
    'VALIDATION_ERROR',
    errors.array()[0].msg,
    422
  );
}

exports.changeStatus = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const result = await changeReservationStatus(req, {
      reservationId: req.params.id,
      status: req.body.status,
      reason: req.body.reason || null,
    });

    return apiResponse.success(res, {
      reservation: result.reservation,
      changed: result.changed,
      oldStatus: result.oldStatus,
      newStatus: result.newStatus,
    });
  } catch (err) {
    if (err.code === 'INVALID_STATUS_TRANSITION') {
      return apiResponse.error(res, 'INVALID_STATUS_TRANSITION', err.message, 422);
    }
    if (err.code === 'FORBIDDEN' || err.status === 403) {
      return apiResponse.error(res, 'FORBIDDEN', err.message, 403);
    }
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      return apiResponse.error(res, 'NOT_FOUND', 'Reservation not found.', 404);
    }
    if (err.code === 'VALIDATION_ERROR') {
      return apiResponse.error(res, 'VALIDATION_ERROR', err.message, 422);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.adminChangeReservationStatus',
      publicMessage: 'Error updating reservation status.',
    });
  }
});

exports.getReservation = asyncHandler(async (req, res, next) => {
  try {
    const data = await getReservationDetail(req.params.id);
    return apiResponse.success(res, data);
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      return apiResponse.error(res, 'NOT_FOUND', 'Reservation not found.', 404);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.adminGetReservation',
      publicMessage: 'Error loading reservation.',
    });
  }
});
