/**
 * Public car catalog handlers: list, search, and detail.
 */
const { validationResult } = require('express-validator');
// Require the '../../repositories/carRepository' module as carRepository.
const carRepository = require('../../repositories/carRepository');
// Destructure object properties into local variables.
const { getSofiaIsoDateString, getTomorrowSofiaIsoDate } = require('../../utils/date/timezone');
// Destructure object properties into local variables.
const { purgeExpired } = require('../../services/sql/bookingSyncSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  parseCarFilterRaw,
  // Contribute this line to the enclosing declaration or statement.
  filtersViewModel,
  // Contribute this line to the enclosing declaration or statement.
  filterCarsByComputedUnitPrice,
// Continue the surrounding logic with this statement.
} = require('../../utils/carFilters');
// Destructure object properties into local variables.
const { loadPricingConfig } = require('../../services/sql/pricingConfigSqlService');
// Destructure object properties into local variables.
const { computePrice } = require('../../utils/pricing/calculateRentalPrice');
// Destructure object properties into local variables.
const { validateBookingDates } = require('../../utils/bookingValidation');
// Destructure object properties into local variables.
const { toHHMM } = require('../../utils/date/normalizeTime');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');

/**
 * List cars for the public catalog with query filters.
 * Side effects: purges expired unpaid holds before listing so availability stays fresh.
 * @param {import('express').Request} req - Query: page + car filter fields
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getCars = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await purgeExpired();

    // Create the criteria constant.
    const criteria = parseCarFilterRaw(req.query);
    // Browse mode prices a 1-day sample for list cards.
    const rentalDays = 1;

    // Destructure object properties into local variables.
    const { cars, currentPage, totalPages } = await carRepository.paginate(criteria, {
      // Provide the page field value.
      page: carRepository.parsePage(req.query.page),
      // Contribute this line to the enclosing declaration or statement.
      rentalDays,
    });

    // Create the now constant.
    const now = new Date();
    // Default search dates for SPA deep-links into booking.
    const pickupDateISO = getSofiaIsoDateString(now);
    // Create the return date iso constant.
    const returnDateISO = getTomorrowSofiaIsoDate(now);

    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Contribute this line to the enclosing declaration or statement.
      cars,
      // Provide the pagination field value.
      pagination: { currentPage, totalPages },
      // Contribute this line to the enclosing declaration or statement.
      pickupDateISO,
      // Contribute this line to the enclosing declaration or statement.
      returnDateISO,
      // Provide the category id field value.
      categoryId: criteria.categoryId ?? null,
      // Provide the filters field value.
      filters: filtersViewModel(criteria, req.query),
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getCars',
      // Provide the public message field value.
      publicMessage: 'Error fetching cars.',
    });
  }
});

/**
 * Return a single public car by id.
 * Side effects: none beyond DB read.
 * @param {import('express').Request} req - Params: carId
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getCarById = asyncHandler(async (req, res, next) => {
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'VALIDATION_ERROR', errors.array()[0].msg, 400);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the car constant.
    const car = await carRepository.findById(req.params.carId);
    // Evaluate the condition and enter the branch when it is true.
    if (!car) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    // Return the resulting value to the caller.
    return apiResponse.success(res, { car });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getCarById',
      // Provide the public message field value.
      publicMessage: 'Error fetching car.',
    });
  }
});

/**
 * Search available cars for a date range and filters.
 * Side effects: none beyond DB/config reads; computes per-car prices for the page.
 * @param {import('express').Request} req - Query: pickup/return date/time/location + filters
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.searchCars = asyncHandler(async (req, res, next) => {
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
      errors.array()[0].msg,
      // Supply the literal value used by the enclosing expression.
      422
    );
  }

  // Start a try block for operations that may fail.
  try {
    // Create the now constant.
    const now = new Date();
    // Create the pickup date only constant.
    const pickupDateOnly = req.query['pickup-date'];
    // Create the return date only constant.
    const returnDateOnly = req.query['return-date'];
    // Create the pickup time constant.
    const pickupTime = toHHMM(req.query['pickup-time']) || req.query['pickup-time'];
    // Create the return time constant.
    const returnTime = toHHMM(req.query['return-time']) || req.query['return-time'];
    // Create the pickup loc constant.
    const pickupLoc = req.query['pickup-location'];
    // Create the return loc constant.
    const returnLoc = req.query['return-location'];
    // Destructure object properties into local variables.
    const {
      // Contribute this line to the enclosing declaration or statement.
      transmission,
      // Contribute this line to the enclosing declaration or statement.
      fuelType,
      // Contribute this line to the enclosing declaration or statement.
      priceMin,
      // Contribute this line to the enclosing declaration or statement.
      priceMax,
      // Contribute this line to the enclosing declaration or statement.
      seatsMin,
      // Contribute this line to the enclosing declaration or statement.
      seatsMax,
      // Contribute this line to the enclosing declaration or statement.
      categoryId,
      // Contribute this line to the enclosing declaration or statement.
      category,
    // Continue the surrounding logic with this statement.
    } = req.query;

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
      // Contribute this line to the enclosing declaration or statement.
      rentalDays,
    // Continue the surrounding logic with this statement.
    } = validateBookingDates({
      // Provide the pickup date field value.
      pickupDate: pickupDateOnly,
      // Provide the return date field value.
      returnDate: returnDateOnly,
      // Provide the pickup time field value.
      pickupTime: pickupTime || '10:00',
      // Provide the return time field value.
      returnTime: returnTime || '10:00',
      // Contribute this line to the enclosing declaration or statement.
      now,
    });

    // Evaluate the condition and enter the branch when it is true.
    if (!isValid || !startDate || !endDate || rentalDays == null) {
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

    // Create the pickup date constant.
    const pickupDate = startDate;
    // Create the return date constant.
    const returnDate = endDate;

    // Create the criteria constant.
    const criteria = parseCarFilterRaw({
      // Contribute this line to the enclosing declaration or statement.
      categoryId,
      // Contribute this line to the enclosing declaration or statement.
      category,
      // Contribute this line to the enclosing declaration or statement.
      transmission,
      // Contribute this line to the enclosing declaration or statement.
      fuelType,
      // Contribute this line to the enclosing declaration or statement.
      seatsMin,
      // Contribute this line to the enclosing declaration or statement.
      seatsMax,
      // Contribute this line to the enclosing declaration or statement.
      priceMin,
      // Contribute this line to the enclosing declaration or statement.
      priceMax,
    });

    // onlyAvailable excludes cars with overlapping holds/bookings for the window.
    const { cars: carsForPage, currentPage, totalPages } = await carRepository.paginate(
      // Contribute this line to the enclosing declaration or statement.
      criteria,
      {
        // Provide the page field value.
        page: carRepository.parsePage(req.query.page),
        // Contribute this line to the enclosing declaration or statement.
        rentalDays,
        // Provide the pickup date field value.
        pickupDate: pickupDateOnly,
        // Provide the return date field value.
        returnDate: returnDateOnly,
        // Provide the pickup time field value.
        pickupTime: pickupTime || '10:00',
        // Provide the return time field value.
        returnTime: returnTime || '10:00',
        // Contribute this line to the enclosing declaration or statement.
        startDate,
        // Contribute this line to the enclosing declaration or statement.
        endDate,
        // Provide the only available field value.
        onlyAvailable: true,
      }
    );

    // Create the pricing config constant.
    const pricingConfig = await loadPricingConfig().catch(() => null);
    // Initialize the mutable page cars variable.
    let pageCars = carsForPage.map((car) => {
      // Create the p constant.
      const p = computePrice(
        // Contribute this line to the enclosing declaration or statement.
        car,
        // Contribute this line to the enclosing declaration or statement.
        pickupDate,
        // Contribute this line to the enclosing declaration or statement.
        returnDate,
        // Contribute this line to the enclosing declaration or statement.
        pickupLoc,
        // Contribute this line to the enclosing declaration or statement.
        returnLoc,
        {},
        // Contribute this line to the enclosing declaration or statement.
        pricingConfig || undefined
      );
      // Return the resulting value to the caller.
      return {
        // Spread car into the surrounding structure.
        ...car,
        // Spread p into the surrounding structure.
        ...p,
        // Provide the price breakdown field value.
        priceBreakdown: p.priceBreakdown,
      };
    });
    // Price-range filters apply to computed unit price, not raw base rate.
    pageCars = filterCarsByComputedUnitPrice(pageCars, criteria);

    // Create the shared rental days constant.
    const sharedRentalDays = pageCars[0]?.rentalDays || rentalDays || 0;
    // Create the shared delivery price constant.
    const sharedDeliveryPrice = pageCars[0]?.deliveryPrice || 0;
    // Create the shared return price constant.
    const sharedReturnPrice = pageCars[0]?.returnPrice || 0;

    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the cars field value.
      cars: pageCars,
      // Provide the pagination field value.
      pagination: { currentPage, totalPages },
      // Provide the search field value.
      search: {
        // Provide the pickup location field value.
        pickupLocation: pickupLoc,
        // Provide the return location field value.
        returnLocation: returnLoc,
        // Provide the pickup date field value.
        pickupDate: pickupDateOnly,
        // Provide the return date field value.
        returnDate: returnDateOnly,
        // Contribute this line to the enclosing declaration or statement.
        pickupTime,
        // Contribute this line to the enclosing declaration or statement.
        returnTime,
      },
      // Provide the rental days field value.
      rentalDays: sharedRentalDays,
      // Provide the delivery price field value.
      deliveryPrice: sharedDeliveryPrice,
      // Provide the return price field value.
      returnPrice: sharedReturnPrice,
      // Provide the filters field value.
      filters: filtersViewModel(criteria, {
        // Contribute this line to the enclosing declaration or statement.
        priceMin,
        // Contribute this line to the enclosing declaration or statement.
        priceMax,
        // Contribute this line to the enclosing declaration or statement.
        seatsMin,
        // Contribute this line to the enclosing declaration or statement.
        seatsMax,
      }),
      // Provide the category id field value.
      categoryId: criteria.categoryId ?? null,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.searchCars',
      // Provide the public message field value.
      publicMessage: 'Error searching cars.',
    });
  }
});
