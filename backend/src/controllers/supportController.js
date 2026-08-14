const carRepository = require('../repositories/carRepository');
const { FEES } = require('../utils/fees');
const { validationResult } = require('express-validator');
const { respondJsonError } = require('../utils/controllerError');
const logger = require('../utils/logger');

exports.getCarsSummary = async (req, res) => {
  try {
    const cars = await carRepository.listAvailable();

    if (!cars || cars.length === 0) {
      return res.json({
        totalCars: 0,
        fuelTypes: [],
        transmissions: [],
        seatOptions: [],
        priceRange: { min: 0, max: 0 },
        priceTiers: {
          tier1_3: { min: 0, max: 0 },
          tier7_31: { min: 0, max: 0 },
          tier31_plus: { min: 0, max: 0 },
        },
      });
    }

    const fuelTypes = [...new Set(cars.map((c) => c.fuelType).filter(Boolean))].sort();
    const transmissions = [...new Set(cars.map((c) => c.transmission).filter(Boolean))].sort();
    const seatOptions = [...new Set(cars.map((c) => c.seats).filter(Boolean))].sort(
      (a, b) => a - b
    );

    const prices = cars.map((c) => c.price || 0).filter((p) => p > 0);
    const tier1_3Prices = cars
      .map((c) => c.priceTier_1_3 || c.price || 0)
      .filter((p) => p > 0);
    const tier7_31Prices = cars
      .map((c) => c.priceTier_7_31 || c.price || 0)
      .filter((p) => p > 0);
    const tier31_plusPrices = cars
      .map((c) => c.priceTier_31_plus || c.price || 0)
      .filter((p) => p > 0);

    const getMinMax = (arr) => ({
      min: arr.length > 0 ? Math.min(...arr) : 0,
      max: arr.length > 0 ? Math.max(...arr) : 0,
    });

    res.json({
      totalCars: cars.length,
      fuelTypes,
      transmissions,
      seatOptions,
      priceRange: getMinMax(prices),
      priceTiers: {
        tier1_3: getMinMax(tier1_3Prices),
        tier7_31: getMinMax(tier7_31Prices),
        tier31_plus: getMinMax(tier31_plusPrices),
      },
    });
  } catch (err) {
    logger.error({ err, correlationId: req.correlationId, context: 'getCarsSummary' }, 'Failed to fetch cars summary');
    return respondJsonError(res, req, {
      message: 'Failed to fetch cars summary.',
    });
  }
};

exports.getCarsByFilter = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid filter parameters',
        correlationId: req.correlationId,
        details: errors.array(),
      },
    });
  }

  try {
    const { categoryId, fuelType, transmission, seatsMin, seatsMax } = req.query;

    const cars = await carRepository.listByFilter({
      categoryId,
      fuelType,
      transmission,
      seatsMin,
      seatsMax,
      onlyAvailable: true,
      limit: 10,
    });

    res.json(cars);
  } catch (err) {
    logger.error({ err, correlationId: req.correlationId, context: 'getCarsByFilter' }, 'Failed to fetch filtered cars');
    return respondJsonError(res, req, {
      message: 'Failed to fetch filtered cars.',
    });
  }
};

exports.getPricingInfo = async (req, res) => {
  try {
    res.json({
      deliveryFees: FEES,
      returnFees: FEES,
      priceTierExplanation: {
        tier1_3: '1-3 days',
        tier7_31: '7-31 days',
        tier31_plus: '31+ days',
      },
    });
  } catch (err) {
    logger.error({ err, correlationId: req.correlationId, context: 'getPricingInfo' }, 'Failed to fetch pricing info');
    return respondJsonError(res, req, {
      message: 'Failed to fetch pricing info.',
    });
  }
};

exports.getCarDetails = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid car id',
        correlationId: req.correlationId,
        details: errors.array(),
      },
    });
  }

  try {
    const { carId } = req.params;
    const car = await carRepository.findById(carId);

    if (!car) {
      return res.status(404).json({
        error: {
          code: 'NOT_FOUND',
          message: 'Car not found',
          correlationId: req.correlationId,
        },
      });
    }

    res.json(car);
  } catch (err) {
    logger.error({ err, correlationId: req.correlationId, context: 'getCarDetails' }, 'Failed to fetch car details');
    return respondJsonError(res, req, {
      message: 'Failed to fetch car details.',
    });
  }
};
