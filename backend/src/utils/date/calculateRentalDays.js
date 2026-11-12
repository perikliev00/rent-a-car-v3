/**
 * Rental-day math: convert a booking window into a charged day count (minimum 1).
 * Uses ceiling of elapsed milliseconds so any partial day still bills as a full day.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Rental days between two Date objects (minimum 1).
 *
 * @param {Date} startDate - Inclusive start of the rental window
 * @param {Date} endDate - Exclusive-ish end; any positive span ceilings to at least 1 day
 * @returns {number} Charged day count (≥ 1)
 * @throws {Error} when either date is invalid or not a Date instance
 */
function computeRentalDays(startDate, endDate) {
  // Reject non-Dates and Invalid Date objects before math.
  if (
    !(startDate instanceof Date) ||
    Number.isNaN(startDate.getTime()) ||
    !(endDate instanceof Date) ||
    Number.isNaN(endDate.getTime())
  ) {
    throw new Error('Invalid dates passed to computeRentalDays');
  }

  // Ceiling of elapsed ms / day, floored at 1 so same-day returns still charge one day.
  const diffMs = endDate.getTime() - startDate.getTime();
  const days = Math.ceil(diffMs / MS_PER_DAY);
  return Math.max(1, days);
}

/**
 * Safe variant used by pricing when inputs may be incomplete.
 * Returns 0 instead of throwing when dates are missing or non-positive.
 *
 * @param {Date | null | undefined} start
 * @param {Date | null | undefined} end
 * @returns {number} Charged days (≥ 1), or 0 when inputs are unusable
 * @throws {never}
 */
function computeRentalDaysSafe(start, end) {
  // Missing / non-Date inputs → treat as unpriced (0 days).
  if (!start || !end || !(start instanceof Date) || !(end instanceof Date)) return 0;
  const diff = end.getTime() - start.getTime();
  // Non-finite or non-positive span → 0 (pricing returns an empty result).
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / MS_PER_DAY));
}

module.exports = {
  MS_PER_DAY,
  computeRentalDays,
  computeRentalDaysSafe,
};
