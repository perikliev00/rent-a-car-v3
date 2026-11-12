/**
 * Customer active-reservation release and release-and-rehold handlers.
 */
const { validationResult } = require('express-validator');
// Require the '../../repositories/carRepository' module as carRepository.
const carRepository = require('../../repositories/carRepository');
// Destructure object properties into local variables.
const { computeBookingPriceAsync } = require('../../utils/pricing');
// Destructure object properties into local variables.
const { validateBookingDates } = require('../../utils/bookingValidation');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  releaseActiveReservationForSession,
  // Contribute this line to the enclosing declaration or statement.
  releaseAndReholdForSession,
// Continue the surrounding logic with this statement.
} = require('../../services/reservationService');
// Destructure object properties into local variables.
const { logCustomerAction } = require('../../services/admin/adminAuditService');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');
// Require the '../../monitoring/metrics' module as metrics.
const metrics = require('../../monitoring/metrics');

/**
 * Release the active session reservation hold.
 * Side effects: cancels/releases the unpaid hold tied to this session when present.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.releaseActiveReservation = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { cancelled } = await releaseActiveReservationForSession(req);

    // Evaluate the condition and enter the branch when it is true.
    if (!cancelled) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'No active reservation.', 404);
    }

    // Return the resulting value to the caller.
    return apiResponse.success(res, { released: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error(
      // Contribute this line to the enclosing declaration or statement.
      { err, correlationId: req.correlationId, context: 'api.releaseActiveReservation' },
      // Supply the literal value used by the enclosing expression.
      'Release reservation error'
    );
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.releaseActiveReservation',
      // Provide the public message field value.
      publicMessage: 'Failed to release reservation.',
    });
  }
});

/**
 * Release the current hold and create a new hold for different dates/car.
 * Side effects: transactional release+rehold; customer audit log; conflict metrics.
 * @param {import('express').Request} req - Body: carId, dates, times, locations, extras?, hotelDelivery?
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.releaseAndReholdReservation = asyncHandler(async (req, res, next) => {
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return apiResponse.error(
      // Contribute this line to the enclosing declaration or statement.
      res,
      // Supply the literal value used by the enclosing expression.
      'VALIDATION_ERROR',
      // Call errors.array to perform this step.
      errors.array()[0]?.msg || 'Invalid request.',
      // Supply the literal value used by the enclosing expression.
      422
    );
  }

  // Destructure object properties into local variables.
  const {
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    pickupDate,
    // Contribute this line to the enclosing declaration or statement.
    returnDate,
    // Contribute this line to the enclosing declaration or statement.
    pickupTime,
    // Contribute this line to the enclosing declaration or statement.
    returnTime,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Update extras with the right-hand side value.
    extras = [],
    // Update hotelDelivery with the right-hand side value.
    hotelDelivery = false,
  // Continue the surrounding logic with this statement.
  } = req.body || {};

  // Start a try block for operations that may fail.
  try {
    // Create the car constant.
    const car = await carRepository.findById(carId);
    // Evaluate the condition and enter the branch when it is true.
    if (!car) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }

    // Create the normalized pickup time constant.
    const normalizedPickupTime = pickupTime || '00:00';
    // Create the normalized return time constant.
    const normalizedReturnTime = returnTime || '23:59';

    // Destructure object properties into local variables.
    const {
      // Contribute this line to the enclosing declaration or statement.
      isValid,
      // Provide the errors field value.
      errors: bookingErrors,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
    // Continue the surrounding logic with this statement.
    } = validateBookingDates({
      // Contribute this line to the enclosing declaration or statement.
      pickupDate,
      // Contribute this line to the enclosing declaration or statement.
      returnDate,
      // Provide the pickup time field value.
      pickupTime: normalizedPickupTime,
      // Provide the return time field value.
      returnTime: normalizedReturnTime,
    });

    // Evaluate the condition and enter the branch when it is true.
    if (!isValid || !startDate || !endDate) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'VALIDATION_ERROR',
        // Contribute this line to the enclosing declaration or statement.
        bookingErrors[0] || 'Invalid booking dates.',
        // Supply the literal value used by the enclosing expression.
        422
      );
    }

    // Create the pricing constant.
    const pricing = await computeBookingPriceAsync(
      // Contribute this line to the enclosing declaration or statement.
      car,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Contribute this line to the enclosing declaration or statement.
      pickupLocation,
      // Contribute this line to the enclosing declaration or statement.
      returnLocation,
      {
        // Provide the extras field value.
        extras: Array.isArray(extras) ? extras : [],
        // Provide the hotel delivery field value.
        hotelDelivery: Boolean(hotelDelivery),
        // Provide the booked at field value.
        bookedAt: new Date(),
      }
    );
    // Evaluate the condition and enter the branch when it is true.
    if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', 'Unable to calculate price.', 422);
    }

    // Create the rehold constant.
    const rehold = await releaseAndReholdForSession(req, {
      // Provide the car id field value.
      carId: car.id,
      // Contribute this line to the enclosing declaration or statement.
      startDate,
      // Contribute this line to the enclosing declaration or statement.
      endDate,
      // Provide the pickup time field value.
      pickupTime: normalizedPickupTime,
      // Provide the return time field value.
      returnTime: normalizedReturnTime,
      // Contribute this line to the enclosing declaration or statement.
      pickupLocation,
      // Contribute this line to the enclosing declaration or statement.
      returnLocation,
      // Contribute this line to the enclosing declaration or statement.
      pricing,
    });

    // Evaluate the condition and enter the branch when it is true.
    if (!rehold.ok) {
      // Evaluate the condition and enter the branch when it is true.
      if (rehold.reason === 'not_found') {
        // Return the resulting value to the caller.
        return apiResponse.error(res, 'NOT_FOUND', 'No active reservation.', 404);
      }
      // Payment in flight — do not move the hold out from under Stripe.
      if (rehold.reason === 'rehold_not_allowed') {
        // Return the resulting value to the caller.
        return apiResponse.error(
          // Contribute this line to the enclosing declaration or statement.
          res,
          // Supply the literal value used by the enclosing expression.
          'REHOLD_NOT_ALLOWED',
          // Supply the literal value used by the enclosing expression.
          'This reservation cannot be moved while payment is processing.',
          // Supply the literal value used by the enclosing expression.
          409
        );
      }
      // Call metrics.incrementReservationConflict to perform this step.
      metrics.incrementReservationConflict('rehold_overlap');
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'CONFLICT',
        // Supply the literal value used by the enclosing expression.
        'Selected car is already reserved/booked in this period.',
        // Supply the literal value used by the enclosing expression.
        409
      );
    }

    // Wait until the asynchronous operation resolves.
    await logCustomerAction(req, {
      // Provide the action field value.
      action: 'customer.reheld',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: rehold.reservation?.id ?? null,
      // Provide the metadata field value.
      metadata: {
        // Provide the from car id field value.
        fromCarId: rehold.fromCarId ?? rehold.historyMetadata?.fromCarId ?? null,
        // Provide the to car id field value.
        toCarId: car.id,
        // Provide the from pickup field value.
        fromPickup:
          // Contribute this line to the enclosing declaration or statement.
          rehold.historyMetadata?.fromPickup ??
          // Continue the surrounding logic with this statement.
          (rehold.fromPickup instanceof Date
            // Continue the surrounding logic with this statement.
            ? rehold.fromPickup.toISOString()
            // Continue the surrounding logic with this statement.
            : rehold.fromPickup ?? null),
        // Provide the from return field value.
        fromReturn:
          // Contribute this line to the enclosing declaration or statement.
          rehold.historyMetadata?.fromReturn ??
          // Continue the surrounding logic with this statement.
          (rehold.fromReturn instanceof Date
            // Continue the surrounding logic with this statement.
            ? rehold.fromReturn.toISOString()
            // Continue the surrounding logic with this statement.
            : rehold.fromReturn ?? null),
        // Provide the to pickup field value.
        toPickup: startDate.toISOString(),
        // Provide the to return field value.
        toReturn: endDate.toISOString(),
      },
    });

    // Return the resulting value to the caller.
    return apiResponse.success(res, { reheld: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error(
      // Contribute this line to the enclosing declaration or statement.
      { err, correlationId: req.correlationId, context: 'api.releaseAndReholdReservation' },
      // Supply the literal value used by the enclosing expression.
      'Release and re-hold reservation error'
    );
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.releaseAndReholdReservation',
      // Provide the public message field value.
      publicMessage: 'Failed to release and re-hold reservation.',
    });
  }
});
