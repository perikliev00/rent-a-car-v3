/**
 * Admin reservation detail, status change, and refund handlers.
 */
const { validationResult } = require('express-validator');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  changeReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  getReservationDetail,
// Continue the surrounding logic with this statement.
} = require('../../../services/admin/reservationAdminService');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Respond with 422 VALIDATION_ERROR for validation failures.
 * Side effects: writes a 422 JSON API error.
 * @param {import('express').Response} res
 * @param {import('express-validator').Result} errors
 * @returns {import('express').Response}
 */
function validationErrorResponse(res, errors) {
  // Return the resulting value to the caller.
  return apiResponse.error(
    // Contribute this line to the enclosing declaration or statement.
    res,
    // Supply the literal value used by the enclosing expression.
    'VALIDATION_ERROR',
    // Call errors.array to perform this step.
    errors.array()[0].msg,
    // Supply the literal value used by the enclosing expression.
    422
  );
}

/**
 * Change reservation operational status.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.changeStatus = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await changeReservationStatus(req, {
      // Provide the reservation id field value.
      reservationId: req.params.id,
      // Provide the status field value.
      status: req.body.status,
      // Provide the reason field value.
      reason: req.body.reason || null,
    });

    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the reservation field value.
      reservation: result.reservation,
      // Provide the changed field value.
      changed: result.changed,
      // Provide the old status field value.
      oldStatus: result.oldStatus,
      // Provide the new status field value.
      newStatus: result.newStatus,
    });
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
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'FORBIDDEN' || err.status === 403) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'FORBIDDEN', err.message, 403);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Reservation not found.', 404);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'VALIDATION_ERROR') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', err.message, 422);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.adminChangeReservationStatus',
      // Provide the public message field value.
      publicMessage: 'Error updating reservation status.',
    });
  }
});

/**
 * Issue a refund for a reservation payment.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.refundReservation = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const {
      // Contribute this line to the enclosing declaration or statement.
      requestReservationRefund,
    // Continue the surrounding logic with this statement.
    } = require('../../../services/payment/refund/reservationRefundService');

    // Create the result constant.
    const result = await requestReservationRefund(req, {
      // Provide the reservation id field value.
      reservationId: req.params.id,
      // Provide the reason field value.
      reason: req.body?.reason || null,
    });

    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the status field value.
      status: result.status,
      // Provide the refund operation field value.
      refundOperation: result.refundOperation,
      // Provide the reservation field value.
      reservation: result.reservation,
      // Provide the idempotent field value.
      idempotent: Boolean(result.idempotent),
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', err.message || 'Reservation not found.', 404);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'REFUND_IN_PROGRESS') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'REFUND_IN_PROGRESS', err.message, 409);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'REFUND_LEDGER_INCONSISTENT') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'REFUND_LEDGER_INCONSISTENT', err.message, 409);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Update err.code with the right-hand side value.
      err.code === 'REFUND_NOT_ALLOWED' ||
      // Update err.code with the right-hand side value.
      err.code === 'REFUND_NO_PAYMENT_INTENT' ||
      // Update err.code with the right-hand side value.
      err.code === 'REFUND_NO_AMOUNT' ||
      // Update err.code with the right-hand side value.
      err.code === 'VALIDATION_ERROR'
    // Continue the surrounding logic with this statement.
    ) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, err.code, err.message, 422);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'REFUND_FAILED') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'REFUND_FAILED', err.message, 502);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'REFUND_INDETERMINATE') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'REFUND_INDETERMINATE', err.message, 503);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'FORBIDDEN' || err.status === 403) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'FORBIDDEN', err.message, 403);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.adminRefundReservation',
      // Provide the public message field value.
      publicMessage: 'Error refunding reservation.',
    });
  }
});

/**
 * Return admin reservation detail.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getReservation = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await getReservationDetail(req.params.id);
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'NOT_FOUND' || err.status === 404) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Reservation not found.', 404);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.adminGetReservation',
      // Provide the public message field value.
      publicMessage: 'Error loading reservation.',
    });
  }
});
