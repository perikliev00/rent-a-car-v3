const { validationResult } = require('express-validator');
const carRepository = require('../../repositories/carRepository');
const { getSofiaIsoDateString, getTomorrowSofiaIsoDate } = require('../../utils/date/timezone');
const { purgeExpired } = require('../../services/sql/bookingSyncSqlService');
const {
  parseCarFilterRaw,
  filtersViewModel,
  filterCarsByComputedUnitPrice,
} = require('../../utils/carFilters');
const { loadPricingConfig } = require('../../services/sql/pricingConfigSqlService');
const { computePrice } = require('../../utils/pricing/calculateRentalPrice');
const { validateBookingDates } = require('../../utils/bookingValidation');
const { toHHMM } = require('../../utils/date/normalizeTime');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');

exports.getCars = asyncHandler(async (req, res, next) => {
  try {
    await purgeExpired();

    const criteria = parseCarFilterRaw(req.query);
    const rentalDays = 1;

    const { cars, currentPage, totalPages } = await carRepository.paginate(criteria, {
      page: carRepository.parsePage(req.query.page),
      rentalDays,
    });

    const now = new Date();
    const pickupDateISO = getSofiaIsoDateString(now);
    const returnDateISO = getTomorrowSofiaIsoDate(now);

    return apiResponse.success(res, {
      cars,
      pagination: { currentPage, totalPages },
      pickupDateISO,
      returnDateISO,
      categoryId: criteria.categoryId ?? null,
      filters: filtersViewModel(criteria, req.query),
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getCars',
      publicMessage: 'Error fetching cars.',
    });
  }
});

exports.getCarById = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return apiResponse.error(res, 'VALIDATION_ERROR', errors.array()[0].msg, 400);
  }

  try {
    const car = await carRepository.findById(req.params.carId);
    if (!car) {
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    return apiResponse.success(res, { car });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getCarById',
      publicMessage: 'Error fetching car.',
    });
  }
});

exports.searchCars = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return apiResponse.error(
      res,
      'VALIDATION_ERROR',
      errors.array()[0].msg,
      422
    );
  }

  try {
    const now = new Date();
    const pickupDateOnly = req.query['pickup-date'];
    const returnDateOnly = req.query['return-date'];
    const pickupTime = toHHMM(req.query['pickup-time']) || req.query['pickup-time'];
    const returnTime = toHHMM(req.query['return-time']) || req.query['return-time'];
    const pickupLoc = req.query['pickup-location'];
    const returnLoc = req.query['return-location'];
    const {
      transmission,
      fuelType,
      priceMin,
      priceMax,
      seatsMin,
      seatsMax,
      categoryId,
      category,
    } = req.query;

    const { startDate, endDate, rentalDays } = validateBookingDates({
      pickupDate: pickupDateOnly,
      returnDate: returnDateOnly,
      pickupTime: pickupTime || '10:00',
      returnTime: returnTime || '10:00',
      now,
    });

    const pickupDate = startDate;
    const returnDate = endDate;

    const criteria = parseCarFilterRaw({
      categoryId,
      category,
      transmission,
      fuelType,
      seatsMin,
      seatsMax,
      priceMin,
      priceMax,
    });

    const { cars: carsForPage, currentPage, totalPages } = await carRepository.paginate(
      criteria,
      {
        page: carRepository.parsePage(req.query.page),
        rentalDays,
        pickupDate: pickupDateOnly,
        returnDate: returnDateOnly,
        pickupTime: pickupTime || '10:00',
        returnTime: returnTime || '10:00',
        startDate,
        endDate,
        onlyAvailable: true,
      }
    );

    const pricingConfig = await loadPricingConfig().catch(() => null);
    let pageCars = carsForPage.map((car) => {
      const p = computePrice(
        car,
        pickupDate,
        returnDate,
        pickupLoc,
        returnLoc,
        {},
        pricingConfig || undefined
      );
      return {
        ...car,
        ...p,
        priceBreakdown: p.priceBreakdown,
      };
    });
    pageCars = filterCarsByComputedUnitPrice(pageCars, criteria);

    const sharedRentalDays = pageCars[0]?.rentalDays || rentalDays || 0;
    const sharedDeliveryPrice = pageCars[0]?.deliveryPrice || 0;
    const sharedReturnPrice = pageCars[0]?.returnPrice || 0;

    return apiResponse.success(res, {
      cars: pageCars,
      pagination: { currentPage, totalPages },
      search: {
        pickupLocation: pickupLoc,
        returnLocation: returnLoc,
        pickupDate: pickupDateOnly,
        returnDate: returnDateOnly,
        pickupTime,
        returnTime,
      },
      rentalDays: sharedRentalDays,
      deliveryPrice: sharedDeliveryPrice,
      returnPrice: sharedReturnPrice,
      filters: filtersViewModel(criteria, {
        priceMin,
        priceMax,
        seatsMin,
        seatsMax,
      }),
      categoryId: criteria.categoryId ?? null,
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.searchCars',
      publicMessage: 'Error searching cars.',
    });
  }
});
