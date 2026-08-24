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
    if (err.code === 'REFUND_IN_PROGRESS') {
      return apiResponse.error(res, 'REFUND_IN_PROGRESS', err.message, 409);
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

exports.refundReservation = asyncHandler(async (req, res, next) => {
  try {
    const {
      requestReservationRefund,
    } = require('../../../services/payment/refund/reservationRefundService');

    const result = await requestReservationRefund(req, {
      reservationId: req.params.id,
      reason: req.body?.reason || null,
    });

    return apiResponse.success(res, {
      status: result.status,
      refundOperation: result.refundOperation,
      reservation: result.reservation,
      idempotent: Boolean(result.idempotent),
    });
  } catch (err) {
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      return apiResponse.error(res, 'NOT_FOUND', err.message || 'Reservation not found.', 404);
    }
    if (err.code === 'REFUND_IN_PROGRESS') {
      return apiResponse.error(res, 'REFUND_IN_PROGRESS', err.message, 409);
    }
    if (err.code === 'REFUND_LEDGER_INCONSISTENT') {
      return apiResponse.error(res, 'REFUND_LEDGER_INCONSISTENT', err.message, 409);
    }
    if (
      err.code === 'REFUND_NOT_ALLOWED' ||
      err.code === 'REFUND_NO_PAYMENT_INTENT' ||
      err.code === 'REFUND_NO_AMOUNT' ||
      err.code === 'VALIDATION_ERROR'
    ) {
      return apiResponse.error(res, err.code, err.message, 422);
    }
    if (err.code === 'REFUND_FAILED') {
      return apiResponse.error(res, 'REFUND_FAILED', err.message, 502);
    }
    if (err.code === 'REFUND_INDETERMINATE') {
      return apiResponse.error(res, 'REFUND_INDETERMINATE', err.message, 503);
    }
    if (err.code === 'FORBIDDEN' || err.status === 403) {
      return apiResponse.error(res, 'FORBIDDEN', err.message, 403);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.adminRefundReservation',
      publicMessage: 'Error refunding reservation.',
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
