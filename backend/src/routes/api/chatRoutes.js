/**
 * External chatbot / AI support API.
 *
 * Response contract (intentionally different from standard /api/* envelope):
 * - Success: raw JSON payloads (no `{ success, data }` wrapper)
 * - Errors: `{ error: { code, message, correlationId, details? } }`
 *
 * See errorHandler `usesApiEnvelope` — `/api/chat` is excluded from the standard envelope.
 */
const express = require('express');
const supportController = require('../../controllers/supportController');
const validateChatRequest = require('../../middleware/validateRequest').validateChatRequest;
const { query, param } = require('express-validator');
const { FUEL_TYPES, TRANSMISSIONS, CAR_SEATS_MIN, CAR_SEATS_MAX } = require('../../constants/carEnums');

const router = express.Router();

router.get('/cars-summary', supportController.getCarsSummary);
router.get(
  '/cars-by-filter',
  [
    query('categoryId')
      .optional()
      .isInt({ min: 1 })
      .withMessage('Invalid category id.'),
    query('fuelType')
      .optional()
      .isIn(FUEL_TYPES)
      .withMessage('Invalid fuel type.'),
    query('transmission')
      .optional()
      .isIn(TRANSMISSIONS)
      .withMessage('Invalid transmission.'),
    query('seatsMin')
      .optional()
      .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
      .withMessage(`seatsMin must be an integer between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}.`),
    query('seatsMax')
      .optional()
      .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
      .withMessage(`seatsMax must be an integer between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}.`),
  ],
  validateChatRequest,
  supportController.getCarsByFilter
);
router.get('/pricing-info', supportController.getPricingInfo);
router.get(
  '/car-details/:carId',
  [
    param('carId')
      .isInt({ min: 1 })
      .withMessage('Invalid car id.'),
  ],
  validateChatRequest,
  supportController.getCarDetails
);

module.exports = router;
