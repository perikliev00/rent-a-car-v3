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
// Require the '../../controllers/supportController' module as supportController.
const supportController = require('../../controllers/supportController');
// Require the '../../middleware/validateRequest' module as validateChatRequest.
const validateChatRequest = require('../../middleware/validateRequest').validateChatRequest;
// Destructure object properties into local variables.
const { query, param } = require('express-validator');
// Destructure object properties into local variables.
const { FUEL_TYPES, TRANSMISSIONS, CAR_SEATS_MIN, CAR_SEATS_MAX } = require('../../constants/carEnums');

// Create the router constant.
const router = express.Router();

// Compact fleet summary for chatbot grounding.
router.get('/cars-summary', supportController.getCarsSummary);
// Filtered car list for chat tool calls.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/cars-by-filter',
  [
    // Call query to perform this step.
    query('categoryId')
      // Call .optional to perform this step.
      .optional()
      // Call .isInt to perform this step.
      .isInt({ min: 1 })
      // Call .withMessage to perform this step.
      .withMessage('Invalid category id.'),
    // Call query to perform this step.
    query('fuelType')
      // Call .optional to perform this step.
      .optional()
      // Call .isIn to perform this step.
      .isIn(FUEL_TYPES)
      // Call .withMessage to perform this step.
      .withMessage('Invalid fuel type.'),
    // Call query to perform this step.
    query('transmission')
      // Call .optional to perform this step.
      .optional()
      // Call .isIn to perform this step.
      .isIn(TRANSMISSIONS)
      // Call .withMessage to perform this step.
      .withMessage('Invalid transmission.'),
    // Call query to perform this step.
    query('seatsMin')
      // Call .optional to perform this step.
      .optional()
      // Call .isInt to perform this step.
      .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
      // Call .withMessage to perform this step.
      .withMessage(`seatsMin must be an integer between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}.`),
    // Call query to perform this step.
    query('seatsMax')
      // Call .optional to perform this step.
      .optional()
      // Call .isInt to perform this step.
      .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
      // Call .withMessage to perform this step.
      .withMessage(`seatsMax must be an integer between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}.`),
  ],
  // Contribute this line to the enclosing declaration or statement.
  validateChatRequest,
  // Contribute this line to the enclosing declaration or statement.
  supportController.getCarsByFilter
);
// Pricing blurb for chat answers.
router.get('/pricing-info', supportController.getPricingInfo);
// Single car detail for chat tool calls.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/car-details/:carId',
  [
    // Call param to perform this step.
    param('carId')
      // Call .isInt to perform this step.
      .isInt({ min: 1 })
      // Call .withMessage to perform this step.
      .withMessage('Invalid car id.'),
  ],
  // Contribute this line to the enclosing declaration or statement.
  validateChatRequest,
  // Contribute this line to the enclosing declaration or statement.
  supportController.getCarDetails
);

// Assign the CommonJS module exports.
module.exports = router;
