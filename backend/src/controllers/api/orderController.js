const { validationResult } = require('express-validator');
const carRepository = require('../../repositories/carRepository');
const { computeBookingPriceAsync } = require('../../utils/pricing');
const { formatDateForDisplay, formatLocationName } = require('../../utils/dateFormatter');
const { toHHMM } = require('../../utils/date/normalizeTime');
const {
  getSessionId,
} = require('../../utils/reservationHelpers');
const { validateBookingDates } = require('../../utils/bookingValidation');
const {
  createPendingReservation,
  findActiveReservationBySession,
  attachCarNameToReservation,
} = require('../../services/reservationService');
const { changeStatus } = require('../../services/reservation/reservationStatusService');
const { normalizeSelectedExtras } = require('../../utils/pricing');
const {
  buildBaseOrderPayload,
  buildOrderViewModel,
} = require('../../services/orderViewModelService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');
const { NotFoundError } = require('../../utils/appError');
const metrics = require('../../monitoring/metrics');

exports.createOrder = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  const {
    carId,
    pickupDate: pickupDateISO,
    returnDate: returnDateISO,
    pickupLocation,
    returnLocation,
    pickupTime,
    returnTime,
  } = req.body || {};

  const car = carId ? await carRepository.findById(carId) : null;
  const pickupDateDisplay = formatDateForDisplay(pickupDateISO);
  const returnDateDisplay = formatDateForDisplay(returnDateISO);
  const pickupLocationDisplay = formatLocationName(pickupLocation);
  const returnLocationDisplay = formatLocationName(returnLocation);

  let pricing = {
    rentalDays: 0,
    deliveryPrice: 0,
    returnPrice: 0,
    totalPrice: 0,
  };

  const buildOrderData = (overrides = {}) => {
    const basePayload = buildBaseOrderPayload({
      pickupDateISO,
      returnDateISO,
      pickupTime,
      returnTime,
      pickupLocation,
      returnLocation,
      pickupDateDisplay,
      returnDateDisplay,
      pickupLocationDisplay,
      returnLocationDisplay,
      pricing,
      releaseRedirect: req.originalUrl,
    });

    return buildOrderViewModel(car, basePayload, {
      message: overrides.message ?? null,
      existingReservation: overrides.existingReservation ?? null,
    });
  };

  if (!errors.isEmpty()) {
    const message = errors.array()[0].msg;
    if (car) {
      return apiResponse.error(res, 'VALIDATION_ERROR', message, 422);
    }
    throw new NotFoundError('Car not found.');
  }

  try {
    if (!car) {
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }

    const {
      isValid,
      errors: bookingErrors,
      startDate,
      endDate,
    } = validateBookingDates({
      pickupDate: pickupDateISO,
      returnDate: returnDateISO,
      pickupTime: pickupTime || '00:00',
      returnTime: returnTime || '23:59',
    });

    if (!isValid || !startDate || !endDate) {
      if (startDate && endDate) {
        pricing = await computeBookingPriceAsync(car, startDate, endDate, pickupLocation, returnLocation);
      }
      return apiResponse.error(
        res,
        'VALIDATION_ERROR',
        bookingErrors[0] || 'Invalid booking dates.',
        422
      );
    }

    const extras = Array.isArray(req.body.extras) ? req.body.extras : [];
    const hotelDelivery = Boolean(req.body.hotelDelivery) || Boolean(req.body.hotelName);

    pricing = await computeBookingPriceAsync(
      car,
      startDate,
      endDate,
      pickupLocation,
      returnLocation,
      { extras, hotelDelivery, bookedAt: new Date() }
    );
    if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
      return apiResponse.error(
        res,
        'VALIDATION_ERROR',
        'Unable to calculate price for this rental. Please try again.',
        422
      );
    }

    const sessionId = getSessionId(req);
    const now = new Date();

    const respondForExistingSessionHold = async (existingForSession) => {
      const existingCarId = existingForSession.carId?.id || existingForSession.carId;
      const sameReservationParams =
        String(existingCarId) === String(car.id) &&
        existingForSession.pickupDate?.getTime?.() === startDate.getTime() &&
        existingForSession.returnDate?.getTime?.() === endDate.getTime() &&
        toHHMM(existingForSession.pickupTime) === toHHMM(pickupTime) &&
        toHHMM(existingForSession.returnTime) === toHHMM(returnTime) &&
        existingForSession.pickupLocation === pickupLocation &&
        existingForSession.returnLocation === returnLocation;

      if (sameReservationParams) {
        const prevExtras = JSON.stringify(
          normalizeSelectedExtras(existingForSession.selectedExtras || [])
        );
        const nextExtras = JSON.stringify(normalizeSelectedExtras(extras));
        const prevHotel = Boolean(existingForSession.hotelDelivery);
        const nextHotel = Boolean(hotelDelivery);

        if (prevExtras !== nextExtras || prevHotel !== nextHotel) {
          await changeStatus({
            reservationId: existingForSession.id,
            newStatus: existingForSession.status || 'pending_payment',
            reason: 'pricing_addons_updated',
            actor: { type: 'customer', req, userId: req?.session?.user?.id },
            patch: {
              pricing: {
                rentalDays: pricing.rentalDays,
                deliveryPrice: pricing.deliveryPrice,
                returnPrice: pricing.returnPrice,
                totalPrice: pricing.totalPrice,
                deposit: pricing.deposit,
                snapshot: pricing.snapshot,
                selectedExtras: pricing.snapshot?.selectedExtras,
                hotelDelivery: pricing.snapshot?.hotelDelivery,
              },
            },
          });
        }

        return apiResponse.success(res, buildOrderData({ message: null, existingReservation: null }));
      }

      await attachCarNameToReservation(existingForSession);
      metrics.incrementReservationConflict('active_session');
      return apiResponse.error(
        res,
        'CONFLICT',
        'You already have an active reservation. Please complete or release it before starting another.',
        409
      );
    };

    const existingForSession = await findActiveReservationBySession(req);
    if (existingForSession) {
      return respondForExistingSessionHold(existingForSession);
    }

    const { overlappingReservation, bookedOverlap, existingActiveReservation } =
      await createPendingReservation(
        {
          carId: car.id,
          sessionId,
          startDate,
          endDate,
          pickupTime,
          returnTime,
          pickupLocation,
          returnLocation,
          pricing,
          now,
        },
        req
      );

    if (existingActiveReservation) {
      return respondForExistingSessionHold(existingActiveReservation);
    }

    if (overlappingReservation) {
      const sessionHoldAfterOverlap = await findActiveReservationBySession(req);
      if (sessionHoldAfterOverlap) {
        return respondForExistingSessionHold(sessionHoldAfterOverlap);
      }
      metrics.incrementReservationConflict('hold_overlap');
      return apiResponse.error(
        res,
        'CONFLICT',
        'Selected car is already reserved in this period. Please choose different dates or a different car.',
        409
      );
    }

    if (bookedOverlap) {
      metrics.incrementReservationConflict('booked_overlap');
      return apiResponse.error(
        res,
        'CONFLICT',
        'Selected car is already booked in this period. Please choose different dates or a different car.',
        409
      );
    }

    return apiResponse.success(res, buildOrderData({ message: null, existingReservation: null }));
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.createOrder',
      publicMessage: 'Error creating order.',
    });
  }
});
