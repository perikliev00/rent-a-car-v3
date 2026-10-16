/**
 * Validate customer booking pick-up/return date-times in the Sofia timezone.
 * Combines parse + business rules (not in past, return after pickup) and rental-day math.
 */

const { parseSofiaDate, getTodayInSofia } = require('./timezone');
const { computeRentalDays } = require('./calculateRentalDays');

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
  pickupDate,
  returnDate,
  pickupTime = '00:00',
  returnTime = '23:59',
  now = new Date(),
}) {
  const errors = [];
  // Interpret wall-clock inputs as Europe/Sofia, then convert to absolute Dates.
  const start = parseSofiaDate(pickupDate, pickupTime);
  const end = parseSofiaDate(returnDate, returnTime);

  // Unparseable inputs → hard fail with null dates (no further rule checks).
  if (
    !start ||
    Number.isNaN(start.getTime()) ||
    !end ||
    Number.isNaN(end.getTime())
  ) {
    errors.push('Invalid date format.');
    return {
      isValid: false,
      errors,
      startDate: null,
      endDate: null,
      rentalDays: null,
    };
  }

  // Pickup must be strictly after "now" (same-day past times rejected).
  if (start <= now) {
    errors.push('Pick-up time must be later than the current time today');
  }

  // Compare against Sofia midnight "today" so calendar past days are rejected.
  const today = getTodayInSofia(now);

  if (start < today || end < today) {
    errors.push('Pick-up and return dates cannot be in the past.');
  }

  // Return must be strictly after pickup.
  if (end <= start) {
    errors.push('Return date must be after pick-up date.');
  }

  if (errors.length > 0) {
    return {
      isValid: false,
      errors,
      startDate: start,
      endDate: end,
      rentalDays: null,
    };
  }

  // Valid window → charged day count (minimum 1).
  const rentalDays = computeRentalDays(start, end);

  return {
    isValid: true,
    errors: [],
    startDate: start,
    endDate: end,
    rentalDays,
  };
}

module.exports = {
  validateBookingDates,
};
