/**
 * Shared status sets and date-range helpers for analytics SQL.
 *
 * Revenue/occupancy only count reservations in billable/active-like statuses.
 * Overlap math uses Europe/Sofia calendar dates for operational reporting.
 */

/** Reservation statuses whose related orders count toward revenue KPIs. */
const REVENUE_STATUSES = Object.freeze([
  // Supply the literal value used by the enclosing expression.
  'paid',
  // Supply the literal value used by the enclosing expression.
  'confirmed',
  // Supply the literal value used by the enclosing expression.
  'car_prepared',
  // Supply the literal value used by the enclosing expression.
  'picked_up',
  // Supply the literal value used by the enclosing expression.
  'active_rental',
  // Supply the literal value used by the enclosing expression.
  'returned',
  // Supply the literal value used by the enclosing expression.
  'completed',
]);

// Create the occupancy statuses constant.
const OCCUPANCY_STATUSES = REVENUE_STATUSES;

/**
 * Inclusive period length in calendar days for [from, to] YYYY-MM-DD.
 */
function periodDayCount(from, to) {
  // Create the a constant.
  const a = new Date(`${from}T00:00:00Z`);
  // Create the b constant.
  const b = new Date(`${to}T00:00:00Z`);
  // Create the days constant.
  const days = Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
  // Return the resulting value to the caller.
  return Math.max(days, 0);
}

/**
 * Overlap days between [pickup, return) and [from, to] inclusive calendar range.
 * Half-open rental interval; range is inclusive on both ends via date casts.
 */
function overlapDaysSql(pickupCol, returnCol, fromParam, toParam) {
  // Return the resulting value to the caller.
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

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  REVENUE_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  OCCUPANCY_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  periodDayCount,
  // Contribute this line to the enclosing declaration or statement.
  overlapDaysSql,
};
