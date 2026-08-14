const { body, param } = require('express-validator');
const {
  TRANSMISSIONS,
  FUEL_TYPES,
  CAR_NAME_MAX_LENGTH,
  CAR_SEATS_MIN,
  CAR_SEATS_MAX,
  CAR_STATUSES,
  FUEL_LEVELS,
  SERVICE_TYPES,
  COMPLIANCE_TYPES,
  COMPLIANCE_STATUSES,
} = require('../constants/carEnums');

function parseTier(value) {
  if (value === undefined || value === null || value === '') return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildPriceTierRules() {
  return [
    body('priceTier_1_3')
      .optional({ checkFalsy: true })
      .toFloat()
      .isFloat({ gt: 0 })
      .withMessage('Tier 1–3 must be a number greater than 0'),
    body('priceTier_7_31')
      .optional({ checkFalsy: true })
      .toFloat()
      .isFloat({ gt: 0 })
      .withMessage('Tier 7–31 must be a number greater than 0'),
    body('priceTier_31_plus')
      .optional({ checkFalsy: true })
      .toFloat()
      .isFloat({ gt: 0 })
      .withMessage('Tier 31+ must be a number greater than 0'),
    body()
      .custom((_, { req }) => {
        const tier1 = parseTier(req.body.priceTier_1_3);
        const tier2 = parseTier(req.body.priceTier_7_31);
        const tier3 = parseTier(req.body.priceTier_31_plus);

        const hasValidTier = tier1 !== null || tier2 !== null || tier3 !== null;
        if (!hasValidTier) {
          throw new Error(
            'At least one price tier (1–3 days, 7–31 days, or 31+ days) is required'
          );
        }

        if (tier1 !== null && tier2 !== null && tier2 > tier1) {
          throw new Error('Tier 7–31 price must not exceed tier 1–3 price.');
        }
        if (tier2 !== null && tier3 !== null && tier3 > tier2) {
          throw new Error('Tier 31+ price must not exceed tier 7–31 price.');
        }
        if (tier1 !== null && tier3 !== null && tier3 > tier1) {
          throw new Error('Tier 31+ price must not exceed tier 1–3 price.');
        }

        return true;
      })
      .withMessage('Invalid price tier configuration'),
  ];
}

function buildFleetFieldRules() {
  return [
    body('registrationNumber')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 32 })
      .withMessage('Registration number must be at most 32 characters'),
    body('vin')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 32 })
      .withMessage('VIN must be at most 32 characters'),
    body('mileage')
      .optional({ checkFalsy: true })
      .toInt()
      .isInt({ min: 0 })
      .withMessage('Mileage must be a non-negative integer'),
    body('fuelLevel')
      .optional({ checkFalsy: true })
      .trim()
      .isIn(FUEL_LEVELS)
      .withMessage(`Fuel level must be one of: ${FUEL_LEVELS.join(', ')}`),
    body('currentLocation')
      .optional({ checkFalsy: true })
      .trim()
      .isLength({ max: 500 })
      .withMessage('Current location must be at most 500 characters'),
    body('insuranceExpiry')
      .optional({ checkFalsy: true })
      .isISO8601({ strict: true })
      .withMessage('Insurance expiry must be a valid date'),
    body('technicalInspectionExpiry')
      .optional({ checkFalsy: true })
      .isISO8601({ strict: true })
      .withMessage('Technical inspection expiry must be a valid date'),
    body('status')
      .optional({ checkFalsy: true })
      .trim()
      .isIn(CAR_STATUSES)
      .withMessage(`Status must be one of: ${CAR_STATUSES.join(', ')}`),
  ];
}

function buildSharedCarFieldRules() {
  return [
    body('name')
      .trim()
      .isLength({ min: 2, max: CAR_NAME_MAX_LENGTH })
      .withMessage(`Name must be between 2 and ${CAR_NAME_MAX_LENGTH} characters`),
    body('transmission')
      .trim()
      .isIn(TRANSMISSIONS)
      .withMessage('Transmission must be Automatic or Manual'),
    body('seats')
      .toInt()
      .isInt({ min: CAR_SEATS_MIN, max: CAR_SEATS_MAX })
      .withMessage(`Seats must be between ${CAR_SEATS_MIN} and ${CAR_SEATS_MAX}`),
    body('fuelType')
      .trim()
      .isIn(FUEL_TYPES)
      .withMessage('Fuel type must be Petrol, Diesel, Hybrid or Electric'),
    body('categoryId')
      .optional({ checkFalsy: true })
      .toInt()
      .isInt({ min: 1 })
      .withMessage('Invalid category id.'),
    ...buildPriceTierRules(),
    ...buildFleetFieldRules(),
  ];
}

const createCarValidationRules = [
  ...buildSharedCarFieldRules(),
  body().custom((_, { req }) => {
    if (!req.file) {
      throw new Error('Car image is required.');
    }
    return true;
  }),
];

const editCarValidationRules = [...buildSharedCarFieldRules()];

const fleetStatusValidationRules = [
  body('status')
    .trim()
    .isIn(CAR_STATUSES)
    .withMessage(`Status must be one of: ${CAR_STATUSES.join(', ')}`),
  body('reason').optional({ checkFalsy: true }).trim().isLength({ max: 500 }),
];

const serviceRecordValidationRules = [
  body('serviceType')
    .trim()
    .isIn(SERVICE_TYPES)
    .withMessage(`Service type must be one of: ${SERVICE_TYPES.join(', ')}`),
  body('description').optional({ checkFalsy: true }).trim().isLength({ max: 2000 }),
  body('cost')
    .optional({ checkFalsy: true })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage('Cost must be a non-negative number'),
  body('mileage')
    .optional({ checkFalsy: true })
    .toInt()
    .isInt({ min: 0 })
    .withMessage('Mileage must be a non-negative integer'),
  body('serviceDate')
    .trim()
    .isISO8601({ strict: true })
    .withMessage('Service date is required'),
  body('nextServiceDate')
    .optional({ checkFalsy: true })
    .isISO8601({ strict: true })
    .withMessage('Next service date must be a valid date'),
];

const damageReportValidationRules = [
  body('description')
    .trim()
    .isLength({ min: 2, max: 4000 })
    .withMessage('Description is required'),
  body('reservationId')
    .optional({ checkFalsy: true })
    .toInt()
    .isInt({ min: 1 })
    .withMessage('Invalid reservation id'),
  body('repairCost')
    .optional({ checkFalsy: true })
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage('Repair cost must be a non-negative number'),
];

const recordIdParamValidation = [
  param('recordId').toInt().isInt({ min: 1 }).withMessage('Invalid record id'),
];

const reportIdParamValidation = [
  param('reportId').toInt().isInt({ min: 1 }).withMessage('Invalid report id'),
];

const docIdParamValidation = [
  param('docId').toInt().isInt({ min: 1 }).withMessage('Invalid document id'),
];

const complianceItemIdParamValidation = [
  param('itemId').toInt().isInt({ min: 1 }).withMessage('Invalid compliance item id'),
];

const complianceValidationRules = [
  body('itemType')
    .trim()
    .isIn(COMPLIANCE_TYPES)
    .withMessage(`Item type must be one of: ${COMPLIANCE_TYPES.join(', ')}`),
  body('title').optional({ checkFalsy: true }).trim().isLength({ max: 255 }),
  body('referenceNumber').optional({ checkFalsy: true }).trim().isLength({ max: 128 }),
  body('issuedAt')
    .optional({ checkFalsy: true })
    .isISO8601({ strict: true })
    .withMessage('Issued date must be a valid date'),
  body('expiresAt')
    .optional({ checkFalsy: true })
    .isISO8601({ strict: true })
    .withMessage('Expiry date must be a valid date'),
  body('notes').optional({ checkFalsy: true }).trim().isLength({ max: 4000 }),
  body('status')
    .optional({ checkFalsy: true })
    .trim()
    .isIn(COMPLIANCE_STATUSES)
    .withMessage(`Status must be one of: ${COMPLIANCE_STATUSES.join(', ')}`),
];

module.exports = {
  createCarValidationRules,
  editCarValidationRules,
  fleetStatusValidationRules,
  serviceRecordValidationRules,
  damageReportValidationRules,
  recordIdParamValidation,
  reportIdParamValidation,
  docIdParamValidation,
  complianceItemIdParamValidation,
  complianceValidationRules,
  TRANSMISSIONS,
  FUEL_TYPES,
};
