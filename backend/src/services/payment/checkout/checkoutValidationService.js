/**
 * Request validation for starting Stripe Checkout (express-validator + booking dates).
 */
const { validationResult } = require('express-validator');
// Destructure object properties into local variables.
const { validateBookingDates } = require('../../../utils/bookingValidation');
// Destructure object properties into local variables.
const { buildRenderOrderPageResponse } = require('./checkoutResponseFactory');

/**
 * @param {import('express').Request} req
 * @returns {import('express-validator').Result}
 */
function validationResultFromReq(req) {
  // Return the resulting value to the caller.
  return validationResult(req);
}

/**
 * Validate checkout body fields and booking date range.
 *
 * @param {import('express').Request} req
 * @param {object} car
 * @param {object} formData
 * @returns {{ ok: true, startDate: Date, endDate: Date } | { ok: false, response: object }}
 */
function validateCheckoutRequest(req, car, formData) {
  // Create the errors constant.
  const errors = validationResultFromReq(req);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!errors.isEmpty()) {
    // Create the message constant.
    const message = errors.array()[0].msg;
    // Return the resulting value to the caller.
    return {
      // Provide the ok field value.
      ok: false,
      // Provide the response field value.
      response: buildRenderOrderPageResponse(car, formData, message, {}),
    };
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
    pickupDate: formData.pickupDate,
    // Provide the return date field value.
    returnDate: formData.returnDate,
    // Provide the pickup time field value.
    pickupTime: formData.pickupTime || '00:00',
    // Provide the return time field value.
    returnTime: formData.returnTime || '23:59',
  });

  // Guard: early-return or throw when required input is missing/invalid.
  if (!isValid || !startDate || !endDate) {
    // Create the message constant.
    const message =
      // Contribute this line to the enclosing declaration or statement.
      bookingErrors[0] || 'Invalid booking dates. Please choose a different range.';
    // Return the resulting value to the caller.
    return {
      // Provide the ok field value.
      ok: false,
      // Provide the response field value.
      response: buildRenderOrderPageResponse(car, formData, message, {}),
    };
  }

  // Return the resulting value to the caller.
  return {
    // Provide the ok field value.
    ok: true,
    // Contribute this line to the enclosing declaration or statement.
    startDate,
    // Contribute this line to the enclosing declaration or statement.
    endDate,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  validationResultFromReq,
  // Contribute this line to the enclosing declaration or statement.
  validateCheckoutRequest,
};
