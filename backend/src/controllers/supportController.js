/**
 * Chatbot/support API handlers with a non-standard response contract (raw JSON / error shape).
 * Success responses are unwrapped; errors use `{ error: { code, message, correlationId } }`.
 */
const carRepository = require('../repositories/carRepository');
// Destructure object properties into local variables.
const { pickPublicCarFields } = require('../services/sql/car/carMapper');
// Destructure object properties into local variables.
const { FEES } = require('../utils/fees');
// Destructure object properties into local variables.
const { validationResult } = require('express-validator');
// Destructure object properties into local variables.
const { respondJsonError } = require('../utils/controllerError');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');

/**
 * Return a compact car fleet summary for the chatbot.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response|void>}
 */
exports.getCarsSummary = async (req, res) => {
  // Start a try block for operations that may fail.
  try {
    // Create the cars constant.
    const cars = await carRepository.listAvailable();

    // Evaluate the condition and enter the branch when it is true.
    if (!cars || cars.length === 0) {
      // Return the resulting value to the caller.
      return res.json({
        // Provide the total cars field value.
        totalCars: 0,
        // Provide the fuel types field value.
        fuelTypes: [],
        // Provide the transmissions field value.
        transmissions: [],
        // Provide the seat options field value.
        seatOptions: [],
        // Provide the price range field value.
        priceRange: { min: 0, max: 0 },
        // Provide the price tiers field value.
        priceTiers: {
          // Provide the tier1 3 field value.
          tier1_3: { min: 0, max: 0 },
          // Provide the tier7 31 field value.
          tier7_31: { min: 0, max: 0 },
          // Provide the tier31 plus field value.
          tier31_plus: { min: 0, max: 0 },
        },
      });
    }

    // Create the fuel types constant.
    const fuelTypes = [...new Set(cars.map((c) => c.fuelType).filter(Boolean))].sort();
    // Create the transmissions constant.
    const transmissions = [...new Set(cars.map((c) => c.transmission).filter(Boolean))].sort();
    // Create the seat options constant.
    const seatOptions = [...new Set(cars.map((c) => c.seats).filter(Boolean))].sort(
      // Continue the surrounding logic with this statement.
      (a, b) => a - b
    );

    // Create the prices constant.
    const prices = cars.map((c) => c.price || 0).filter((p) => p > 0);
    // Create the tier1 3 prices constant.
    const tier1_3Prices = cars
      // Call .map to perform this step.
      .map((c) => c.priceTier_1_3 || c.price || 0)
      // Call .filter to perform this step.
      .filter((p) => p > 0);
    // Create the tier7 31 prices constant.
    const tier7_31Prices = cars
      // Call .map to perform this step.
      .map((c) => c.priceTier_7_31 || c.price || 0)
      // Call .filter to perform this step.
      .filter((p) => p > 0);
    // Create the tier31 plus prices constant.
    const tier31_plusPrices = cars
      // Call .map to perform this step.
      .map((c) => c.priceTier_31_plus || c.price || 0)
      // Call .filter to perform this step.
      .filter((p) => p > 0);

    /**
     * @param {number[]} arr
     * @returns {{ min: number, max: number }}
     */
    const getMinMax = (arr) => ({
      // Provide the min field value.
      min: arr.length > 0 ? Math.min(...arr) : 0,
      // Provide the max field value.
      max: arr.length > 0 ? Math.max(...arr) : 0,
    });

    // Call res.json to perform this step.
    res.json({
      // Provide the total cars field value.
      totalCars: cars.length,
      // Contribute this line to the enclosing declaration or statement.
      fuelTypes,
      // Contribute this line to the enclosing declaration or statement.
      transmissions,
      // Contribute this line to the enclosing declaration or statement.
      seatOptions,
      // Provide the price range field value.
      priceRange: getMinMax(prices),
      // Provide the price tiers field value.
      priceTiers: {
        // Provide the tier1 3 field value.
        tier1_3: getMinMax(tier1_3Prices),
        // Provide the tier7 31 field value.
        tier7_31: getMinMax(tier7_31Prices),
        // Provide the tier31 plus field value.
        tier31_plus: getMinMax(tier31_plusPrices),
      },
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, correlationId: req.correlationId, context: 'getCarsSummary' }, 'Failed to fetch cars summary');
    // Return the resulting value to the caller.
    return respondJsonError(res, req, {
      // Provide the message field value.
      message: 'Failed to fetch cars summary.',
    });
  }
};

/**
 * Return cars matching optional category/fuel/transmission/seats filters.
 * Side effects: none beyond DB reads (capped list for chat tool size).
 * @param {import('express').Request} req - Query filters from chatRoutes validators
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response|void>}
 */
exports.getCarsByFilter = async (req, res) => {
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return res.status(400).json({
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'VALIDATION_ERROR',
        // Provide the message field value.
        message: 'Invalid filter parameters',
        // Provide the correlation id field value.
        correlationId: req.correlationId,
        // Provide the details field value.
        details: errors.array(),
      },
    });
  }

  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { categoryId, fuelType, transmission, seatsMin, seatsMax } = req.query;

    // Create the cars constant.
    const cars = await carRepository.listByFilter({
      // Contribute this line to the enclosing declaration or statement.
      categoryId,
      // Contribute this line to the enclosing declaration or statement.
      fuelType,
      // Contribute this line to the enclosing declaration or statement.
      transmission,
      // Contribute this line to the enclosing declaration or statement.
      seatsMin,
      // Contribute this line to the enclosing declaration or statement.
      seatsMax,
      // Provide the only available field value.
      onlyAvailable: true,
      // Provide the limit field value.
      limit: 10,
    });

    // Call res.json to perform this step.
    res.json((cars || []).map((car) => pickPublicCarFields(car)).filter(Boolean));
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, correlationId: req.correlationId, context: 'getCarsByFilter' }, 'Failed to fetch filtered cars');
    // Return the resulting value to the caller.
    return respondJsonError(res, req, {
      // Provide the message field value.
      message: 'Failed to fetch filtered cars.',
    });
  }
};

/**
 * Return pricing metadata used by the chatbot (static fee map + tier labels).
 * Side effects: none.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response|void>}
 */
exports.getPricingInfo = async (req, res) => {
  // Start a try block for operations that may fail.
  try {
    // Call res.json to perform this step.
    res.json({
      // Provide the delivery fees field value.
      deliveryFees: FEES,
      // Provide the return fees field value.
      returnFees: FEES,
      // Provide the price tier explanation field value.
      priceTierExplanation: {
        // Provide the tier1 3 field value.
        tier1_3: '1-3 days',
        // Provide the tier7 31 field value.
        tier7_31: '7-31 days',
        // Provide the tier31 plus field value.
        tier31_plus: '31+ days',
      },
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, correlationId: req.correlationId, context: 'getPricingInfo' }, 'Failed to fetch pricing info');
    // Return the resulting value to the caller.
    return respondJsonError(res, req, {
      // Provide the message field value.
      message: 'Failed to fetch pricing info.',
    });
  }
};

/**
 * Return detailed car info for a single car id (raw car object, not API envelope).
 * Side effects: none beyond DB read.
 * @param {import('express').Request} req - Params: carId
 * @param {import('express').Response} res
 * @returns {Promise<import('express').Response|void>}
 */
exports.getCarDetails = async (req, res) => {
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return res.status(400).json({
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'VALIDATION_ERROR',
        // Provide the message field value.
        message: 'Invalid car id',
        // Provide the correlation id field value.
        correlationId: req.correlationId,
        // Provide the details field value.
        details: errors.array(),
      },
    });
  }

  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { carId } = req.params;
    // Create the car constant.
    const car = await carRepository.findById(carId);

    // Evaluate the condition and enter the branch when it is true.
    if (!car) {
      // Return the resulting value to the caller.
      return res.status(404).json({
        // Provide the error field value.
        error: {
          // Provide the code field value.
          code: 'NOT_FOUND',
          // Provide the message field value.
          message: 'Car not found',
          // Provide the correlation id field value.
          correlationId: req.correlationId,
        },
      });
    }

    // Call res.json to perform this step.
    res.json(pickPublicCarFields(car));
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err, correlationId: req.correlationId, context: 'getCarDetails' }, 'Failed to fetch car details');
    // Return the resulting value to the caller.
    return respondJsonError(res, req, {
      // Provide the message field value.
      message: 'Failed to fetch car details.',
    });
  }
};
