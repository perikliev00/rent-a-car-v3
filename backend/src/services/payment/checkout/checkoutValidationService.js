/**
 * Request validation for starting Stripe Checkout (express-validator + booking dates).
 */
const { validationResult } = require('express-validator');
const { validateBookingDates } = require('../../../utils/bookingValidation');
const { buildRenderOrderPageResponse } = require('./checkoutResponseFactory');

/**
 * @param {import('express').Request} req
 * @returns {import('express-validator').Result}
 */
function validationResultFromReq(req) {
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
  const errors = validationResultFromReq(req);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!errors.isEmpty()) {
    const message = errors.array()[0].msg;
    return {
      ok: false,
      response: buildRenderOrderPageResponse(car, formData, message, {}),
    };
  }

  const {
    isValid,
    errors: bookingErrors,
    startDate,
    endDate,
  } = validateBookingDates({
    pickupDate: formData.pickupDate,
    returnDate: formData.returnDate,
    pickupTime: formData.pickupTime || '00:00',
    returnTime: formData.returnTime || '23:59',
  });

  // Guard: early-return or throw when required input is missing/invalid.
  if (!isValid || !startDate || !endDate) {
    const message =
      bookingErrors[0] || 'Invalid booking dates. Please choose a different range.';
    return {
      ok: false,
      response: buildRenderOrderPageResponse(car, formData, message, {}),
    };
  }

  return {
    ok: true,
    startDate,
    endDate,
  };
}

module.exports = {
  validationResultFromReq,
  validateCheckoutRequest,
};
