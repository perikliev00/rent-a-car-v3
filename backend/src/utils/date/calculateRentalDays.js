const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Rental days between two Date objects (minimum 1).
 * @throws {Error} when either date is invalid
 */
function computeRentalDays(startDate, endDate) {
  if (
    !(startDate instanceof Date) ||
    Number.isNaN(startDate.getTime()) ||
    !(endDate instanceof Date) ||
    Number.isNaN(endDate.getTime())
  ) {
    throw new Error('Invalid dates passed to computeRentalDays');
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const days = Math.ceil(diffMs / MS_PER_DAY);
  return Math.max(1, days);
}

/** Safe variant used by pricing when inputs may be incomplete. */
function computeRentalDaysSafe(start, end) {
  if (!start || !end || !(start instanceof Date) || !(end instanceof Date)) return 0;
  const diff = end.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff <= 0) return 0;
  return Math.max(1, Math.ceil(diff / MS_PER_DAY));
}

module.exports = {
  MS_PER_DAY,
  computeRentalDays,
  computeRentalDaysSafe,
};
