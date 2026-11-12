/**
 * Customer order creation handler (booking flow).
 * Creates or reuses a pending reservation hold for the browser session, then
 * returns an order view-model for the checkout step.
 */
const { validationResult } = require('express-validator');
// Require the '../../repositories/carRepository' module as carRepository.
const carRepository = require('../../repositories/carRepository');
// Destructure object properties into local variables.
const { computeBookingPriceAsync } = require('../../utils/pricing');
// Destructure object properties into local variables.
const { formatDateForDisplay, formatLocationName } = require('../../utils/dateFormatter');
// Destructure object properties into local variables.
const { toHHMM } = require('../../utils/date/normalizeTime');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  getSessionId,
// Continue the surrounding logic with this statement.
} = require('../../utils/reservationHelpers');
// Destructure object properties into local variables.
const { validateBookingDates, isWithinRentalLimits } = require('../../utils/bookingValidation');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createPendingReservation,
  // Contribute this line to the enclosing declaration or statement.
  findActiveReservationBySession,
  // Contribute this line to the enclosing declaration or statement.
  attachCarNameToReservation,
// Continue the surrounding logic with this statement.
} = require('../../services/reservationService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../services/reservation/reservationStatusService');
// Destructure object properties into local variables.
const { normalizeSelectedExtras } = require('../../utils/pricing');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildBaseOrderPayload,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderViewModel,
// Continue the surrounding logic with this statement.
} = require('../../services/orderViewModelService');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');
// Destructure object properties into local variables.
const { NotFoundError } = require('../../utils/appError');
// Require the '../../monitoring/metrics' module as metrics.
const metrics = require('../../monitoring/metrics');

/**
 * Create a customer order / reservation hold from booking input.
 * Side effects: may create/update a pending reservation, bump conflict metrics,
 * and mutate pricing on an existing session hold when only addons change.
 * @param {import('express').Request} req - Body: carId, dates, times, locations, extras?, hotel*
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.createOrder = asyncHandler(async (req, res, next) => {
  // Create the errors constant.
  const errors = validationResult(req);
  // Destructure object properties into local variables.
  const {
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Provide the pickup date field value.
    pickupDate: pickupDateISO,
    // Provide the return date field value.
    returnDate: returnDateISO,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Contribute this line to the enclosing declaration or statement.
    pickupTime,
    // Contribute this line to the enclosing declaration or statement.
    returnTime,
  // Continue the surrounding logic with this statement.
  } = req.body || {};

  // Load car early so validation failures can still shape an order-page payload.
  const car = carId ? await carRepository.findById(carId) : null;
  // Create the pickup date display constant.
  const pickupDateDisplay = formatDateForDisplay(pickupDateISO);
  // Create the return date display constant.
  const returnDateDisplay = formatDateForDisplay(returnDateISO);
  // Create the pickup location display constant.
  const pickupLocationDisplay = formatLocationName(pickupLocation);
  // Create the return location display constant.
  const returnLocationDisplay = formatLocationName(returnLocation);

  // Initialize the mutable pricing variable.
  let pricing = {
    // Provide the rental days field value.
    rentalDays: 0,
    // Provide the delivery price field value.
    deliveryPrice: 0,
    // Provide the return price field value.
    returnPrice: 0,
    // Provide the total price field value.
    totalPrice: 0,
  };

  /**
   * Build the SPA order view-model using current pricing + display fields.
   * @param {{ message?: string|null, existingReservation?: object|null }} [overrides]
   * @returns {object}
   */
  const buildOrderData = (overrides = {}) => {
    // Create the base payload constant.
    const basePayload = buildBaseOrderPayload({
      // Contribute this line to the enclosing declaration or statement.
      pickupDateISO,
      // Contribute this line to the enclosing declaration or statement.
      returnDateISO,
      // Contribute this line to the enclosing declaration or statement.
      pickupTime,
      // Contribute this line to the enclosing declaration or statement.
      returnTime,
      // Contribute this line to the enclosing declaration or statement.
      pickupLocation,
      // Contribute this line to the enclosing declaration or statement.
      returnLocation,
      // Contribute this line to the enclosing declaration or statement.
      pickupDateDisplay,
      // Contribute this line to the enclosing declaration or statement.
      returnDateDisplay,
      // Contribute this line to the enclosing declaration or statement.
      pickupLocationDisplay,
      // Contribute this line to the enclosing declaration or statement.
      returnLocationDisplay,
      // Contribute this line to the enclosing declaration or statement.
      pricing,
      // Provide the release redirect field value.
      releaseRedirect: req.originalUrl,
    });

    // Return the resulting value to the caller.
    return buildOrderViewModel(car, basePayload, {
      // Provide the message field value.
      message: overrides.message ?? null,
      // Provide the existing reservation field value.
      existingReservation: overrides.existingReservation ?? null,
    });
  };

  // Validation failed: prefer 422 when car exists; otherwise treat as missing car.
  if (!errors.isEmpty()) {
    // Create the message constant.
    const message = errors.array()[0].msg;
    // Evaluate the condition and enter the branch when it is true.
    if (car) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', message, 422);
    }
    // Throw an error to stop the current control flow.
    throw new NotFoundError('Car not found.');
  }

  // Start a try block for operations that may fail.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (!car) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }

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
      // Provide the pickup date field value.
      pickupDate: pickupDateISO,
      // Provide the return date field value.
      returnDate: returnDateISO,
      // Provide the pickup time field value.
      pickupTime: pickupTime || '00:00',
      // Provide the return time field value.
      returnTime: returnTime || '23:59',
    });

    // Evaluate the condition and enter the branch when it is true.
    if (!isValid || !startDate || !endDate) {
      // Partial price is only for small parsed windows. Oversized ranges must not
      // enter the pricing engine on the way to a 422.
      if (startDate && endDate && isWithinRentalLimits(startDate, endDate)) {
        // Store the awaited result in pricing.
        pricing = await computeBookingPriceAsync(car, startDate, endDate, pickupLocation, returnLocation);
      }
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

    // Create the extras constant.
    const extras = Array.isArray(req.body.extras) ? req.body.extras : [];
    // hotelName alone implies hotel delivery for legacy clients.
    const hotelDelivery = Boolean(req.body.hotelDelivery) || Boolean(req.body.hotelName);

    // Store the awaited result in pricing.
    pricing = await computeBookingPriceAsync(
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
      // Continue the surrounding logic with this statement.
      { extras, hotelDelivery, bookedAt: new Date() }
    );
    // Evaluate the condition and enter the branch when it is true.
    if (!pricing || !Number.isFinite(pricing.totalPrice) || pricing.totalPrice <= 0) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'VALIDATION_ERROR',
        // Supply the literal value used by the enclosing expression.
        'Unable to calculate price for this rental. Please try again.',
        // Supply the literal value used by the enclosing expression.
        422
      );
    }

    // Create the session id constant.
    const sessionId = getSessionId(req);
    // Create the now constant.
    const now = new Date();

    /**
     * Handle an existing unpaid hold for this session: reuse when params match
     * (optionally refreshing addon pricing), otherwise return 409 conflict.
     * @param {object} existingForSession
     * @returns {Promise<import('express').Response>}
     */
    const respondForExistingSessionHold = async (existingForSession) => {
      // Create the existing car id constant.
      const existingCarId = existingForSession.carId?.id || existingForSession.carId;
      // Create the same reservation params constant.
      const sameReservationParams =
        // Call String to perform this step.
        String(existingCarId) === String(car.id) &&
        // Continue the surrounding logic with this statement.
        existingForSession.pickupDate?.getTime?.() === startDate.getTime() &&
        // Continue the surrounding logic with this statement.
        existingForSession.returnDate?.getTime?.() === endDate.getTime() &&
        // Call toHHMM to perform this step.
        toHHMM(existingForSession.pickupTime) === toHHMM(pickupTime) &&
        // Call toHHMM to perform this step.
        toHHMM(existingForSession.returnTime) === toHHMM(returnTime) &&
        // Update existingForSession.pickupLocation with the right-hand side value.
        existingForSession.pickupLocation === pickupLocation &&
        // Update existingForSession.returnLocation with the right-hand side value.
        existingForSession.returnLocation === returnLocation;

      // Evaluate the condition and enter the branch when it is true.
      if (sameReservationParams) {
        // Create the prev extras constant.
        const prevExtras = JSON.stringify(
          // Call normalizeSelectedExtras to perform this step.
          normalizeSelectedExtras(existingForSession.selectedExtras || [])
        );
        // Create the next extras constant.
        const nextExtras = JSON.stringify(normalizeSelectedExtras(extras));
        // Create the prev hotel constant.
        const prevHotel = Boolean(existingForSession.hotelDelivery);
        // Create the next hotel constant.
        const nextHotel = Boolean(hotelDelivery);

        // Same trip params but addons/hotel changed → patch pricing without new hold.
        if (prevExtras !== nextExtras || prevHotel !== nextHotel) {
          // Wait until the asynchronous operation resolves.
          await changeStatus({
            // Provide the reservation id field value.
            reservationId: existingForSession.id,
            // Provide the new status field value.
            newStatus: existingForSession.status || 'pending_payment',
            // Provide the reason field value.
            reason: 'pricing_addons_updated',
            // Provide the actor field value.
            actor: { type: 'customer', req, userId: req?.session?.user?.id },
            // Provide the patch field value.
            patch: {
              // Provide the pricing field value.
              pricing: {
                // Provide the rental days field value.
                rentalDays: pricing.rentalDays,
                // Provide the delivery price field value.
                deliveryPrice: pricing.deliveryPrice,
                // Provide the return price field value.
                returnPrice: pricing.returnPrice,
                // Provide the total price field value.
                totalPrice: pricing.totalPrice,
                // Provide the deposit field value.
                deposit: pricing.deposit,
                // Provide the snapshot field value.
                snapshot: pricing.snapshot,
                // Provide the selected extras field value.
                selectedExtras: pricing.snapshot?.selectedExtras,
                // Provide the hotel delivery field value.
                hotelDelivery: pricing.snapshot?.hotelDelivery,
              },
            },
          });
        }

        // Return the resulting value to the caller.
        return apiResponse.success(res, buildOrderData({ message: null, existingReservation: null }));
      }

      // Wait until the asynchronous operation resolves.
      await attachCarNameToReservation(existingForSession);
      // Call metrics.incrementReservationConflict to perform this step.
      metrics.incrementReservationConflict('active_session');
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'CONFLICT',
        // Supply the literal value used by the enclosing expression.
        'You already have an active reservation. Please complete or release it before starting another.',
        // Supply the literal value used by the enclosing expression.
        409
      );
    };

    // Create the existing for session constant.
    const existingForSession = await findActiveReservationBySession(req);
    // Evaluate the condition and enter the branch when it is true.
    if (existingForSession) {
      // Return the resulting value to the caller.
      return respondForExistingSessionHold(existingForSession);
    }

    // Destructure object properties into local variables.
    const { overlappingReservation, bookedOverlap, existingActiveReservation } =
      // Wait until the asynchronous operation resolves.
      await createPendingReservation(
        {
          // Provide the car id field value.
          carId: car.id,
          // Contribute this line to the enclosing declaration or statement.
          sessionId,
          // Contribute this line to the enclosing declaration or statement.
          startDate,
          // Contribute this line to the enclosing declaration or statement.
          endDate,
          // Contribute this line to the enclosing declaration or statement.
          pickupTime,
          // Contribute this line to the enclosing declaration or statement.
          returnTime,
          // Contribute this line to the enclosing declaration or statement.
          pickupLocation,
          // Contribute this line to the enclosing declaration or statement.
          returnLocation,
          // Contribute this line to the enclosing declaration or statement.
          pricing,
          // Contribute this line to the enclosing declaration or statement.
          now,
        },
        // Reference the identifier used by the enclosing expression.
        req
      );

    // Race: another request created a session hold while we were inserting.
    if (existingActiveReservation) {
      // Return the resulting value to the caller.
      return respondForExistingSessionHold(existingActiveReservation);
    }

    // Evaluate the condition and enter the branch when it is true.
    if (overlappingReservation) {
      // Prefer session-hold conflict messaging when our session somehow obtained a hold.
      const sessionHoldAfterOverlap = await findActiveReservationBySession(req);
      // Evaluate the condition and enter the branch when it is true.
      if (sessionHoldAfterOverlap) {
        // Return the resulting value to the caller.
        return respondForExistingSessionHold(sessionHoldAfterOverlap);
      }
      // Call metrics.incrementReservationConflict to perform this step.
      metrics.incrementReservationConflict('hold_overlap');
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'CONFLICT',
        // Supply the literal value used by the enclosing expression.
        'Selected car is already reserved in this period. Please choose different dates or a different car.',
        // Supply the literal value used by the enclosing expression.
        409
      );
    }

    // Evaluate the condition and enter the branch when it is true.
    if (bookedOverlap) {
      // Call metrics.incrementReservationConflict to perform this step.
      metrics.incrementReservationConflict('booked_overlap');
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'CONFLICT',
        // Supply the literal value used by the enclosing expression.
        'Selected car is already booked in this period. Please choose different dates or a different car.',
        // Supply the literal value used by the enclosing expression.
        409
      );
    }

    // Return the resulting value to the caller.
    return apiResponse.success(res, buildOrderData({ message: null, existingReservation: null }));
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.createOrder',
      // Provide the public message field value.
      publicMessage: 'Error creating order.',
    });
  }
});
