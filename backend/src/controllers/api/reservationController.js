const { validationResult } = require('express-validator');
const carRepository = require('../../repositories/carRepository');
const { computeBookingPriceAsync } = require('../../utils/pricing');
const { validateBookingDates } = require('../../utils/bookingValidation');
const {
  releaseActiveReservationForSession,
  releaseAndReholdForSession,
} = require('../../services/reservationService');
const { logCustomerAction } = require('../../services/admin/adminAuditService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');
const logger = require('../../utils/logger');

exports.releaseActiveReservation = asyncHandler(async (req, res, next) => {
  try {
    const { cancelled } = await releaseActiveReservationForSession(req);

    if (!cancelled) {
      return apiResponse.error(res, 'NOT_FOUND', 'No active reservation.', 404);
    }

    return apiResponse.success(res, { released: true });
  } catch (err) {
    logger.error(
      { err, correlationId: req.correlationId, context: 'api.releaseActiveReservation' },
      'Release reservation error'
    );
    return forwardControllerError(err, req, next, {
      context: 'api.releaseActiveReservation',
      publicMessage: 'Failed to release reservation.',
    });
  }
});

exports.releaseAndReholdReservation = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return apiResponse.error(
      res,
      'VALIDATION_ERROR',
      errors.array()[0]?.msg || 'Invalid request.',
      422
    );
  }

  const {
    carId,
    pickupDate,
    returnDate,
    pickupTime,
    returnTime,
    pickupLocation,
    returnLocation,
    extras = [],
    hotelDelivery = false,
  } = req.body || {};

  try {
    const car = await carRepository.findById(carId);
    if (!car) {
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }

    const normalizedPickupTime = pickupTime || '00:00';
    const normalizedReturnTime = returnTime || '23:59';

    const {
      isValid,
      errors: bookingErrors,
      startDate,
      endDate,
    } = validateBookingDates({
      pickupDate,
      returnDate,
      pickupTime: normalizedPickupTime,
      returnTime: normalizedReturnTime,
    });

    if (!isValid || !startDate || !endDate) {
      return apiResponse.error(
        res,
        'VALIDATION_ERROR',
        bookingErrors[0] || 'Invalid booking dates.',
        422
      );
    }

    const pricing = await computeBookingPriceAsync(
      car,
      startDate,
      endDate,
      pickupLocation,
      returnLocation,
      {
        extras: Array.isArray(extras) ? extras : [],
        hotelDelivery: Boolean(hotelDelivery),
        bookedAt: new Date(),
      }
    );
    if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
      return apiResponse.error(res, 'VALIDATION_ERROR', 'Unable to calculate price.', 422);
    }

    const rehold = await releaseAndReholdForSession(req, {
      carId: car.id,
      startDate,
      endDate,
      pickupTime: normalizedPickupTime,
      returnTime: normalizedReturnTime,
      pickupLocation,
      returnLocation,
      pricing,
    });

    if (!rehold.ok) {
      if (rehold.reason === 'not_found') {
        return apiResponse.error(res, 'NOT_FOUND', 'No active reservation.', 404);
      }
      if (rehold.reason === 'rehold_not_allowed') {
        return apiResponse.error(
          res,
          'REHOLD_NOT_ALLOWED',
          'This reservation cannot be moved while payment is processing.',
          409
        );
      }
      return apiResponse.error(
        res,
        'CONFLICT',
        'Selected car is already reserved/booked in this period.',
        409
      );
    }

    await logCustomerAction(req, {
      action: 'customer.reheld',
      entityType: 'reservation',
      entityId: rehold.reservation?.id ?? null,
      metadata: {
        fromCarId: rehold.fromCarId ?? rehold.historyMetadata?.fromCarId ?? null,
        toCarId: car.id,
        fromPickup:
          rehold.historyMetadata?.fromPickup ??
          (rehold.fromPickup instanceof Date
            ? rehold.fromPickup.toISOString()
            : rehold.fromPickup ?? null),
        fromReturn:
          rehold.historyMetadata?.fromReturn ??
          (rehold.fromReturn instanceof Date
            ? rehold.fromReturn.toISOString()
            : rehold.fromReturn ?? null),
        toPickup: startDate.toISOString(),
        toReturn: endDate.toISOString(),
      },
    });

    return apiResponse.success(res, { reheld: true });
  } catch (err) {
    logger.error(
      { err, correlationId: req.correlationId, context: 'api.releaseAndReholdReservation' },
      'Release and re-hold reservation error'
    );
    return forwardControllerError(err, req, next, {
      context: 'api.releaseAndReholdReservation',
      publicMessage: 'Failed to release and re-hold reservation.',
    });
  }
});
