/**
 * Validate customer booking pick-up/return date-times in the Sofia timezone.
 * Combines parse + business rules (not in past, return after pickup) and rental-day math.
 */

const { parseSofiaDate, getTodayInSofia } = require('./timezone');
// Destructure object properties into local variables.
const { computeRentalDays } = require('./calculateRentalDays');
// Destructure object properties into local variables.
const { MAX_RENTAL_DAYS, exceedsRentalDayLimit } = require('./rentalLimits');

/**
 * Parse and validate booking dates/times; return rental days when valid.
 *
 * @param {object} params
 * @param {string} params.pickupDate - Calendar date (YYYY-MM-DD or combined datetime).
 * @param {string} params.returnDate
 * @param {string} [params.pickupTime='00:00']
 * @param {string} [params.returnTime='23:59']
 * @param {Date} [params.now=new Date()] - Reference "now" for past-date checks.
 * @returns {{
 *   isValid: boolean,
 *   errors: string[],
 *   startDate: Date | null,
 *   endDate: Date | null,
 *   rentalDays: number | null
 * }}
 * @throws {never} Validation failures are returned in `errors`, not thrown
 */
function validateBookingDates({
  // Contribute this line to the enclosing declaration or statement.
  pickupDate,
  // Contribute this line to the enclosing declaration or statement.
  returnDate,
  // Update pickupTime with the right-hand side value.
  pickupTime = '00:00',
  // Update returnTime with the right-hand side value.
  returnTime = '23:59',
  // Update now with the right-hand side value.
  now = new Date(),
// Continue the surrounding logic with this statement.
}) {
  // Create the errors constant.
  const errors = [];
  // Interpret wall-clock inputs as Europe/Sofia, then convert to absolute Dates.
  const start = parseSofiaDate(pickupDate, pickupTime);
  // Create the end constant.
  const end = parseSofiaDate(returnDate, returnTime);

  // Unparseable inputs → hard fail with null dates (no further rule checks).
  if (
    // Contribute this line to the enclosing declaration or statement.
    !start ||
    // Call Number.isNaN to perform this step.
    Number.isNaN(start.getTime()) ||
    // Contribute this line to the enclosing declaration or statement.
    !end ||
    // Call Number.isNaN to perform this step.
    Number.isNaN(end.getTime())
  // Continue the surrounding logic with this statement.
  ) {
    // Call errors.push to perform this step.
    errors.push('Invalid date format.');
    // Return the resulting value to the caller.
    return {
      // Provide the is valid field value.
      isValid: false,
      // Contribute this line to the enclosing declaration or statement.
      errors,
      // Provide the start date field value.
      startDate: null,
      // Provide the end date field value.
      endDate: null,
      // Provide the rental days field value.
      rentalDays: null,
    };
  }

  // Pickup must be strictly after "now" (same-day past times rejected).
  if (start <= now) {
    // Call errors.push to perform this step.
    errors.push('Pick-up time must be later than the current time today');
  }

  // Compare against Sofia midnight "today" so calendar past days are rejected.
  const today = getTodayInSofia(now);

  // Evaluate the condition and enter the branch when it is true.
  if (start < today || end < today) {
    // Call errors.push to perform this step.
    errors.push('Pick-up and return dates cannot be in the past.');
  }

  // Return must be strictly after pickup.
  if (end <= start) {
    // Call errors.push to perform this step.
    errors.push('Return date must be after pick-up date.');
  }

  // Bound the window before any caller turns it into per-day pricing work.
  let rentalDays = null;
  // Evaluate the condition and enter the branch when it is true.
  if (end > start) {
    // Create the charged days constant.
    const chargedDays = computeRentalDays(start, end);
    // Evaluate the condition and enter the branch when it is true.
    if (exceedsRentalDayLimit(chargedDays)) {
      // Call errors.push to perform this step.
      errors.push(`Rental period cannot exceed ${MAX_RENTAL_DAYS} days.`);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Update rentalDays with the right-hand side value.
      rentalDays = chargedDays;
    }
  }

  // Evaluate the condition and enter the branch when it is true.
  if (errors.length > 0) {
    // Return the resulting value to the caller.
    return {
      // Provide the is valid field value.
      isValid: false,
      // Contribute this line to the enclosing declaration or statement.
      errors,
      // Provide the start date field value.
      startDate: start,
      // Provide the end date field value.
      endDate: end,
      // Provide the rental days field value.
      rentalDays: null,
    };
  }

  // Return the resulting value to the caller.
  return {
    // Provide the is valid field value.
    isValid: true,
    // Provide the errors field value.
    errors: [],
    // Provide the start date field value.
    startDate: start,
    // Provide the end date field value.
    endDate: end,
    // Contribute this line to the enclosing declaration or statement.
    rentalDays,
  };
}

/**
 * True when both instants parse and the charged span is inside the domain cap.
 * Callers that still want a partial price for other validation failures must
 * use this before pricing.
 *
 * @param {Date} start
 * @param {Date} end
 * @param {Date} [now]
 * @returns {boolean}
 */
function isWithinRentalLimits(start, end, _now = new Date()) {
  // Evaluate the condition and enter the branch when it is true.
  if (!(start instanceof Date) || !(end instanceof Date) || end <= start) return false;
  // Create the charged days constant.
  const chargedDays = computeRentalDays(start, end);
  // Evaluate the condition and enter the branch when it is true.
  if (exceedsRentalDayLimit(chargedDays)) return false;
  // Return the resulting value to the caller.
  return true;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  validateBookingDates,
  // Contribute this line to the enclosing declaration or statement.
  isWithinRentalLimits,
};
