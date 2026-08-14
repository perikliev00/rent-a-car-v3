/**
 * Shared status sets and date-range helpers for analytics SQL.
 */

const REVENUE_STATUSES = Object.freeze([
  'paid',
  'confirmed',
  'car_prepared',
  'picked_up',
  'active_rental',
  'returned',
  'completed',
]);

const OCCUPANCY_STATUSES = REVENUE_STATUSES;

/**
 * Inclusive period length in calendar days for [from, to] YYYY-MM-DD.
 */
function periodDayCount(from, to) {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  const days = Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
  return Math.max(days, 0);
}

/**
 * Overlap days between [pickup, return) and [from, to] inclusive calendar range.
 * Half-open rental interval; range is inclusive on both ends via date casts.
 */
function overlapDaysSql(pickupCol, returnCol, fromParam, toParam) {
  return `
    GREATEST(
      0,
      (
        LEAST((${returnCol} AT TIME ZONE 'Europe/Sofia')::date, $${toParam}::date)
        - GREATEST((${pickupCol} AT TIME ZONE 'Europe/Sofia')::date, $${fromParam}::date)
      )
    )
  `;
}

module.exports = {
  REVENUE_STATUSES,
  OCCUPANCY_STATUSES,
  periodDayCount,
  overlapDaysSql,
};
