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
  return !Number.isFinite(rentalDays) || rentalDays > MAX_RENTAL_DAYS;
}

module.exports = {
  MAX_RENTAL_DAYS,
  exceedsRentalDayLimit,
};
