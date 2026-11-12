/**
 * Seasonal and weekend surcharge lines applied per charge-day of a rental.
 * Seasons use recurring MM-DD windows (may wrap across the year boundary).
 */

const { round2, applyAdj } = require('./pricingMath');
// Destructure object properties into local variables.
const { MAX_RENTAL_DAYS, exceedsRentalDayLimit } = require('../date/rentalLimits');

/**
 * Extract UTC calendar month/day from a Date (1-based month).
 *
 * @param {Date} date - Instant whose UTC calendar day is inspected
 * @returns {{ month: number, day: number }}
 * @throws {never}
 */
function dayOfYearMonthDay(date) {
  // Return the resulting value to the caller.
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

/**
 * Pack month/day into a sortable numeric key (MMDD) for season window compares.
 *
 * @param {number} month - 1–12
 * @param {number} day - 1–31
 * @returns {number} month * 100 + day
 * @throws {never}
 */
function mdKey(month, day) {
  // Return the resulting value to the caller.
  return month * 100 + day;
}

/**
 * Recurring MM-DD season window (supports wrap across year, e.g. Nov–Feb).
 * When start ≤ end, the window is inclusive within one year; otherwise it wraps.
 *
 * @param {Date} date - Charge date to test
 * @param {{ startMonth: number, startDay: number, endMonth: number, endDay: number }} season
 * @returns {boolean} True when the date's UTC MM-DD falls inside the season window
 * @throws {never}
 */
function dateInSeason(date, season) {
  // Compare packed MMDD keys so wrap seasons need only one OR of ranges.
  const { month, day } = dayOfYearMonthDay(date);
  // Create the cur constant.
  const cur = mdKey(month, day);
  // Create the start constant.
  const start = mdKey(season.startMonth, season.startDay);
  // Create the end constant.
  const end = mdKey(season.endMonth, season.endDay);
  // Evaluate the condition and enter the branch when it is true.
  if (start <= end) return cur >= start && cur <= end;
  // Wrap: e.g. Nov 1 – Feb 28 → in season if ≥ start OR ≤ end.
  return cur >= start || cur <= end;
}

/**
 * One UTC calendar date per charged rental day, starting at `start`.
 *
 * @param {Date} start - Rental start instant (UTC calendar day anchors the series)
 * @param {number} rentalDays - Number of charge days to emit
 * @returns {Date[]} Array of UTC midnight Dates, length rentalDays (or empty)
 * @throws {never}
 */
function listChargeDates(start, rentalDays) {
  // Create the dates constant.
  const dates = [];
  // Evaluate the condition and enter the branch when it is true.
  if (!start || rentalDays <= 0) return dates;
  // Refuse before allocation. Callers must already have rejected this window.
  if (exceedsRentalDayLimit(rentalDays)) {
    // Create the err constant.
    const err = new Error(`Rental period cannot exceed ${MAX_RENTAL_DAYS} days.`);
    // Update err.code with the right-hand side value.
    err.code = 'RENTAL_PERIOD_TOO_LONG';
    // Throw an error to stop the current control flow.
    throw err;
  }
  // Walk forward one UTC calendar day at a time for each charged day.
  for (let i = 0; i < rentalDays; i += 1) {
    // Call dates.push to perform this step.
    dates.push(
      // Continue the surrounding logic with this statement.
      new Date(
        // Call Date.UTC to perform this step.
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i)
      )
    );
  }
  // Return the resulting value to the caller.
  return dates;
}

/**
 * Apply active season and weekend rules for the rental window.
 * Seasonal and weekend amounts are returned separately so the discount base can exclude delivery/extras.
 *
 * @param {object} params
 * @param {object} params.cfg - Pricing config with `seasons` and `weekendRules`
 * @param {Date} params.start - Rental start
 * @param {number} params.rentalDays - Charge day count
 * @param {number} params.dayPrice - Daily base rate used for percent adjustments
 * @returns {{ seasonalAmount: number, weekendAmount: number, lines: object[] }}
 * @throws {never}
 */
function applySeasonalAndWeekendAdjustments({ cfg, start, rentalDays, dayPrice }) {
  // Create the lines constant.
  const lines = [];
  // Expand the rental into one charge date per day for overlap counting.
  const chargeDates = listChargeDates(start, rentalDays);

  // Seasonal: percent of base, or fixed_per_day × overlapping season days
  const activeSeasons = (cfg.seasons || []).filter((s) => s.active);
  // Initialize the mutable seasonal amount variable.
  let seasonalAmount = 0;
  // Iterate using the loop initializer, condition, and step.
  for (const season of activeSeasons) {
    // Count how many charge days fall inside this season window.
    const seasonDays = chargeDates.filter((d) => dateInSeason(d, season)).length;
    // Evaluate the condition and enter the branch when it is true.
    if (seasonDays === 0) continue;
    // Initialize the mutable amount variable.
    let amount = 0;
    // Evaluate the condition and enter the branch when it is true.
    if (season.adjType === 'fixed_per_day') {
      // Update amount with the right-hand side value.
      amount = applyAdj(0, 'fixed_per_day', season.adjValue, seasonDays);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // percent of (dayPrice × seasonDays)
      amount = applyAdj(dayPrice * seasonDays, 'percent', season.adjValue);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (amount === 0) continue;
    // Update seasonalAmount with the right-hand side value.
    seasonalAmount = round2(seasonalAmount + amount);
    // Call lines.push to perform this step.
    lines.push({
      // Provide the code field value.
      code: `season_${season.id || season.name}`,
      // Provide the label field value.
      label: season.name,
      // Contribute this line to the enclosing declaration or statement.
      amount,
      // Provide the type field value.
      type: 'surcharge',
    });
  }

  // Weekend premium on weekend charge-days only
  let weekendAmount = 0;
  // Create the weekend rule constant.
  const weekendRule = (cfg.weekendRules || []).find((r) => r.active);
  // Evaluate the condition and enter the branch when it is true.
  if (weekendRule) {
    // weekdays is an array of UTC getUTCDay() values (0=Sun … 6=Sat).
    const weekendDays = chargeDates.filter((d) =>
      // Call weekendRule.weekdays.includes to perform this step.
      weekendRule.weekdays.includes(d.getUTCDay())
    // Continue the surrounding logic with this statement.
    ).length;
    // Evaluate the condition and enter the branch when it is true.
    if (weekendDays > 0) {
      // Evaluate the condition and enter the branch when it is true.
      if (weekendRule.adjType === 'fixed_per_day') {
        // Update weekendAmount with the right-hand side value.
        weekendAmount = applyAdj(0, 'fixed_per_day', weekendRule.adjValue, weekendDays);
      // Contribute this line to the enclosing declaration or statement.
      } else {
        // Update weekendAmount with the right-hand side value.
        weekendAmount = applyAdj(dayPrice * weekendDays, 'percent', weekendRule.adjValue);
      }
      // Evaluate the condition and enter the branch when it is true.
      if (weekendAmount !== 0) {
        // Call lines.push to perform this step.
        lines.push({
          // Provide the code field value.
          code: `weekend_${weekendRule.id || 'rule'}`,
          // Provide the label field value.
          label: weekendRule.name || 'Weekend',
          // Provide the amount field value.
          amount: weekendAmount,
          // Provide the type field value.
          type: 'surcharge',
        });
      }
    }
  }

  // Return the resulting value to the caller.
  return { seasonalAmount, weekendAmount, lines };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listChargeDates,
  // Contribute this line to the enclosing declaration or statement.
  dateInSeason,
  // Contribute this line to the enclosing declaration or statement.
  applySeasonalAndWeekendAdjustments,
};
