/**
 * express-validator rules for admin car create/update and related fleet payloads.
 */
const { body, param } = require('express-validator');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  TRANSMISSIONS,
  // Contribute this line to the enclosing declaration or statement.
  FUEL_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  CAR_NAME_MAX_LENGTH,
  // Contribute this line to the enclosing declaration or statement.
  CAR_SEATS_MIN,
  // Contribute this line to the enclosing declaration or statement.
  CAR_SEATS_MAX,
  // Contribute this line to the enclosing declaration or statement.
  CAR_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  FUEL_LEVELS,
  // Contribute this line to the enclosing declaration or statement.
  SERVICE_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  COMPLIANCE_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  COMPLIANCE_STATUSES,
// Continue the surrounding logic with this statement.
} = require('../constants/carEnums');

/**
 * Parse an optional price-tier field into a positive float, or null when empty/invalid.
 *
 * @param {unknown} value - Raw body field
 * @returns {number | null} Positive finite tier price, or null when empty/invalid
 * @throws {never}
 */
function parseTier(value) {
  // Empty / missing → treat as "tier not provided".
  if (value === undefined || value === null || value === '') return null;
  // Create the parsed constant.
  const parsed = parseFloat(value);
  // Return the resulting value to the caller.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Build express-validator rules for car price tiers and their relative constraints.
 * Longer rentals must not be priced higher per day than shorter tiers.
 *
 * @returns {import('express-validator').ValidationChain[]}
 * @throws {never} Returns rule chains; custom validators throw Error on invalid configs at request time
 */
function buildPriceTierRules() {
  // Return the resulting value to the caller.
  return [
    // Individual optional tier fields (must be > 0 when present).
    body('priceTier_1_3')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .toFloat to perform this step.
      .toFloat()
      // Call .isFloat to perform this step.
      .isFloat({ gt: 0 })
      // Call .withMessage to perform this step.
      .withMessage('Tier 1–3 must be a number greater than 0'),
    // Call body to perform this step.
    body('priceTier_7_31')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .toFloat to perform this step.
      .toFloat()
      // Call .isFloat to perform this step.
      .isFloat({ gt: 0 })
      // Call .withMessage to perform this step.
      .withMessage('Tier 7–31 must be a number greater than 0'),
    // Call body to perform this step.
    body('priceTier_31_plus')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .toFloat to perform this step.
      .toFloat()
      // Call .isFloat to perform this step.
      .isFloat({ gt: 0 })
      // Call .withMessage to perform this step.
      .withMessage('Tier 31+ must be a number greater than 0'),
    // Cross-field: require at least one tier and enforce non-increasing prices with duration.
    body()
      // Call .custom to perform this step.
      .custom((_, { req }) => {
        // Create the tier1 constant.
        const tier1 = parseTier(req.body.priceTier_1_3);
        // Create the tier2 constant.
        const tier2 = parseTier(req.body.priceTier_7_31);
        // Create the tier3 constant.
        const tier3 = parseTier(req.body.priceTier_31_plus);

        // Create the has valid tier constant.
        const hasValidTier = tier1 !== null || tier2 !== null || tier3 !== null;
        // Evaluate the condition and enter the branch when it is true.
        if (!hasValidTier) {
          // Throw an error to stop the current control flow.
          throw new Error(
            // Continue the surrounding logic with this statement.
            'At least one price tier (1–3 days, 7–31 days, or 31+ days) is required'
          );
        }

        // Evaluate the condition and enter the branch when it is true.
        if (tier1 !== null && tier2 !== null && tier2 > tier1) {
          // Throw an error to stop the current control flow.
          throw new Error('Tier 7–31 price must not exceed tier 1–3 price.');
        }
        // Evaluate the condition and enter the branch when it is true.
        if (tier2 !== null && tier3 !== null && tier3 > tier2) {
          // Throw an error to stop the current control flow.
          throw new Error('Tier 31+ price must not exceed tier 7–31 price.');
        }
        // Evaluate the condition and enter the branch when it is true.
        if (tier1 !== null && tier3 !== null && tier3 > tier1) {
          // Throw an error to stop the current control flow.
          throw new Error('Tier 31+ price must not exceed tier 1–3 price.');
        }

        // Return the resulting value to the caller.
        return true;
      })
      // Call .withMessage to perform this step.
      .withMessage('Invalid price tier configuration'),
  ];
}

/**
 * Build express-validator rules for fleet metadata fields on a car.
 *
 * @returns {import('express-validator').ValidationChain[]}
 * @throws {never}
 */
function buildFleetFieldRules() {
  // Return the resulting value to the caller.
  return [
    // Call body to perform this step.
    body('registrationNumber')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .trim to perform this step.
      .trim()
      // Call .isLength to perform this step.
      .isLength({ max: 32 })
      // Call .withMessage to perform this step.
      .withMessage('Registration number must be at most 32 characters'),
    // Call body to perform this step.
    body('vin')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .trim to perform this step.
      .trim()
      // Call .isLength to perform this step.
      .isLength({ max: 32 })
      // Call .withMessage to perform this step.
      .withMessage('VIN must be at most 32 characters'),
    // Call body to perform this step.
    body('mileage')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .toInt to perform this step.
      .toInt()
      // Call .isInt to perform this step.
      .isInt({ min: 0 })
      // Call .withMessage to perform this step.
      .withMessage('Mileage must be a non-negative integer'),
    // Call body to perform this step.
    body('fuelLevel')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .trim to perform this step.
      .trim()
      // Call .isIn to perform this step.
      .isIn(FUEL_LEVELS)
      // Call .withMessage to perform this step.
      .withMessage(`Fuel level must be one of: ${FUEL_LEVELS.join(', ')}`),
    // Call body to perform this step.
    body('currentLocation')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .trim to perform this step.
      .trim()
      // Call .isLength to perform this step.
      .isLength({ max: 500 })
      // Call .withMessage to perform this step.
      .withMessage('Current location must be at most 500 characters'),
    // Call body to perform this step.
    body('insuranceExpiry')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .isISO8601 to perform this step.
      .isISO8601({ strict: true })
      // Call .withMessage to perform this step.
      .withMessage('Insurance expiry must be a valid date'),
    // Call body to perform this step.
    body('technicalInspectionExpiry')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .isISO8601 to perform this step.
      .isISO8601({ strict: true })
      // Call .withMessage to perform this step.
      .withMessage('Technical inspection expiry must be a valid date'),
    // Call body to perform this step.
    body('status')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .trim to perform this step.
      .trim()
      // Call .isIn to perform this step.
      .isIn(CAR_STATUSES)
      // Call .withMessage to perform this step.
      .withMessage(`Status must be one of: ${CAR_STATUSES.join(', ')}`),
  ];
}

/**
 * Build shared create/update car field rules (name, tiers, fleet fields).
 *
 * @returns {import('express-validator').ValidationChain[]}
 * @throws {never}
 */
function buildSharedCarFieldRules() {
  // Return the resulting value to the caller.
  return [
    // Core catalog fields required on create/update.
    body('name')
      // Call .trim to perform this step.
      .trim()
      // Call .isLength to perform this step.
      .isLength({ min: 2, max: CAR_NAME_MAX_LENGTH })
      // Call .withMessage to perform this step.
      .withMessage(`Name must be between 2 and ${CAR_NAME_MAX_LENGTH} characters`),
    // Call body to perform this step.
    body('transmission')
      // Call .trim to perform this step.
      .trim()
      // Call .isIn to perform this step.
      .isIn(TRANSMISSIONS)
      // Call .withMessage to perform this step.
      .withMessage('Transmission must be Automatic or Manual'),
    // Call body to perform this step.
    body('seats')
      // Call .toInt to perform this step.
      .toInt()
      // Call .isInt to perform this step.
      .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
      // Call .withMessage to perform this step.
      .withMessage(`Seats must be between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}`),
    // Call body to perform this step.
    body('fuelType')
      // Call .trim to perform this step.
      .trim()
      // Call .isIn to perform this step.
      .isIn(FUEL_TYPES)
      // Call .withMessage to perform this step.
      .withMessage('Fuel type must be Petrol, Diesel, Hybrid or Electric'),
    // Call body to perform this step.
    body('categoryId')
      // Call .optional to perform this step.
      .optional({ checkFalsy: true })
      // Call .toInt to perform this step.
      .toInt()
      // Call .isInt to perform this step.
      .isInt({ min: 1 })
      // Call .withMessage to perform this step.
      .withMessage('Invalid category id.'),
    // Compose tier + fleet rule groups.
    ...buildPriceTierRules(),
    // Call ...buildFleetFieldRules to perform this step.
    ...buildFleetFieldRules(),
  ];
}

// Create the create car validation rules constant.
const createCarValidationRules = [
  // Call ...buildSharedCarFieldRules to perform this step.
  ...buildSharedCarFieldRules(),
  // Call body to perform this step.
  body().custom((_, { req }) => {
    // Evaluate the condition and enter the branch when it is true.
    if (!req.file) {
      // Throw an error to stop the current control flow.
      throw new Error('Car image is required.');
    }
    // Return the resulting value to the caller.
    return true;
  }),
];

// Create the edit car validation rules constant.
const editCarValidationRules = [...buildSharedCarFieldRules()];

// Create the fleet status validation rules constant.
const fleetStatusValidationRules = [
  // Call body to perform this step.
  body('status')
    // Call .trim to perform this step.
    .trim()
    // Call .isIn to perform this step.
    .isIn(CAR_STATUSES)
    // Call .withMessage to perform this step.
    .withMessage(`Status must be one of: ${CAR_STATUSES.join(', ')}`),
  // Call body to perform this step.
  body('reason').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

// Create the service record validation rules constant.
const serviceRecordValidationRules = [
  // Call body to perform this step.
  body('serviceType')
    // Call .trim to perform this step.
    .trim()
    // Call .isIn to perform this step.
    .isIn(SERVICE_TYPES)
    // Call .withMessage to perform this step.
    .withMessage(`Service type must be one of: ${SERVICE_TYPES.join(', ')}`),
  // Call body to perform this step.
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  // Call body to perform this step.
  body('cost')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .toFloat to perform this step.
    .toFloat()
    // Call .isFloat to perform this step.
    .isFloat({ min: 0 })
    // Call .withMessage to perform this step.
    .withMessage('Cost must be a non-negative number'),
  // Call body to perform this step.
  body('mileage')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .toInt to perform this step.
    .toInt()
    // Call .isInt to perform this step.
    .isInt({ min: 0 })
    // Call .withMessage to perform this step.
    .withMessage('Mileage must be a non-negative integer'),
  // Call body to perform this step.
  body('serviceDate')
    // Call .trim to perform this step.
    .trim()
    // Call .isISO8601 to perform this step.
    .isISO8601({ strict: true })
    // Call .withMessage to perform this step.
    .withMessage('Service date is required'),
  // Call body to perform this step.
  body('nextServiceDate')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isISO8601 to perform this step.
    .isISO8601({ strict: true })
    // Call .withMessage to perform this step.
    .withMessage('Next service date must be a valid date'),
];

// Create the damage report validation rules constant.
const damageReportValidationRules = [
  // Call body to perform this step.
  body('description')
    // Call .trim to perform this step.
    .trim()
    // Call .isLength to perform this step.
    .isLength({ min: 2, max: 4000 })
    // Call .withMessage to perform this step.
    .withMessage('Description is required'),
  // Call body to perform this step.
  body('reservationId')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .toInt to perform this step.
    .toInt()
    // Call .isInt to perform this step.
    .isInt({ min: 1 })
    // Call .withMessage to perform this step.
    .withMessage('Invalid reservation id'),
  // Call body to perform this step.
  body('repairCost')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .toFloat to perform this step.
    .toFloat()
    // Call .isFloat to perform this step.
    .isFloat({ min: 0 })
    // Call .withMessage to perform this step.
    .withMessage('Repair cost must be a non-negative number'),
];

// Create the record id param validation constant.
const recordIdParamValidation = [
  // Call param to perform this step.
  param('recordId').toInt().isInt({ min: 1 }).withMessage('Invalid record id'),
];

// Create the report id param validation constant.
const reportIdParamValidation = [
  // Call param to perform this step.
  param('reportId').toInt().isInt({ min: 1 }).withMessage('Invalid report id'),
];

// Create the doc id param validation constant.
const docIdParamValidation = [
  // Call param to perform this step.
  param('docId').toInt().isInt({ min: 1 }).withMessage('Invalid document id'),
];

// Create the compliance item id param validation constant.
const complianceItemIdParamValidation = [
  // Call param to perform this step.
  param('itemId').toInt().isInt({ min: 1 }).withMessage('Invalid compliance item id'),
];

// Create the compliance validation rules constant.
const complianceValidationRules = [
  // Call body to perform this step.
  body('itemType')
    // Call .trim to perform this step.
    .trim()
    // Call .isIn to perform this step.
    .isIn(COMPLIANCE_TYPES)
    // Call .withMessage to perform this step.
    .withMessage(`Item type must be one of: ${COMPLIANCE_TYPES.join(', ')}`),
  // Call body to perform this step.
  body('title').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  // Call body to perform this step.
  body('referenceNumber').optional({ checkFalsy: true }).trim().isLength({ max: 128 }),
  // Call body to perform this step.
  body('issuedAt')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isISO8601 to perform this step.
    .isISO8601({ strict: true })
    // Call .withMessage to perform this step.
    .withMessage('Issued date must be a valid date'),
  // Call body to perform this step.
  body('expiresAt')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .isISO8601 to perform this step.
    .isISO8601({ strict: true })
    // Call .withMessage to perform this step.
    .withMessage('Expiry date must be a valid date'),
  // Call body to perform this step.
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 4000 }),
  // Call body to perform this step.
  body('status')
    // Call .optional to perform this step.
    .optional({ checkFalsy: true })
    // Call .trim to perform this step.
    .trim()
    // Call .isIn to perform this step.
    .isIn(COMPLIANCE_STATUSES)
    // Call .withMessage to perform this step.
    .withMessage(`Status must be one of: ${COMPLIANCE_STATUSES.join(', ')}`),
];

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createCarValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  editCarValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  fleetStatusValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  serviceRecordValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  damageReportValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  recordIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  reportIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  docIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  complianceItemIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  complianceValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  TRANSMISSIONS,
  // Contribute this line to the enclosing declaration or statement.
  FUEL_TYPES,
};
