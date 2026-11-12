/**
 * Hard bound for a single rental calculation.
 * The UI and API do not define a maximum advance-booking horizon.
 * The cost that has to be capped is the per-day charge loop, which matches
 * the existing 366-day analytics window (a leap year).
 */

/** Inclusive maximum charged days, including a leap-year length. */
const MAX_RENTAL_DAYS = 366;

/**
 * @param {number} rentalDays
 * @returns {boolean}
 */
function exceedsRentalDayLimit(rentalDays) {
  // Return the resulting value to the caller.
  return !Number.isFinite(rentalDays) || rentalDays > MAX_RENTAL_DAYS;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  MAX_RENTAL_DAYS,
  // Contribute this line to the enclosing declaration or statement.
  exceedsRentalDayLimit,
};
