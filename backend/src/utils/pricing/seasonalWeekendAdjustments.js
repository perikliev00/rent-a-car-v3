/**
 * Seasonal and weekend surcharge lines applied per charge-day of a rental.
 * Seasons use recurring MM-DD windows (may wrap across the year boundary).
 */

const { round2, applyAdj } = require('./pricingMath');

/**
 * Extract UTC calendar month/day from a Date (1-based month).
 *
 * @param {Date} date - Instant whose UTC calendar day is inspected
 * @returns {{ month: number, day: number }}
 * @throws {never}
 */
function dayOfYearMonthDay(date) {
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
  const cur = mdKey(month, day);
  const start = mdKey(season.startMonth, season.startDay);
  const end = mdKey(season.endMonth, season.endDay);
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
  const dates = [];
  if (!start || rentalDays <= 0) return dates;
  // Walk forward one UTC calendar day at a time for each charged day.
  for (let i = 0; i < rentalDays; i += 1) {
    dates.push(
      new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i)
      )
    );
  }
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
  const lines = [];
  // Expand the rental into one charge date per day for overlap counting.
  const chargeDates = listChargeDates(start, rentalDays);

  // Seasonal: percent of base, or fixed_per_day × overlapping season days
  const activeSeasons = (cfg.seasons || []).filter((s) => s.active);
  let seasonalAmount = 0;
  for (const season of activeSeasons) {
    // Count how many charge days fall inside this season window.
    const seasonDays = chargeDates.filter((d) => dateInSeason(d, season)).length;
    if (seasonDays === 0) continue;
    let amount = 0;
    if (season.adjType === 'fixed_per_day') {
      amount = applyAdj(0, 'fixed_per_day', season.adjValue, seasonDays);
    } else {
      // percent of (dayPrice × seasonDays)
      amount = applyAdj(dayPrice * seasonDays, 'percent', season.adjValue);
    }
    if (amount === 0) continue;
    seasonalAmount = round2(seasonalAmount + amount);
    lines.push({
      code: `season_${season.id || season.name}`,
      label: season.name,
      amount,
      type: 'surcharge',
    });
  }

  // Weekend premium on weekend charge-days only
  let weekendAmount = 0;
  const weekendRule = (cfg.weekendRules || []).find((r) => r.active);
  if (weekendRule) {
    // weekdays is an array of UTC getUTCDay() values (0=Sun … 6=Sat).
    const weekendDays = chargeDates.filter((d) =>
      weekendRule.weekdays.includes(d.getUTCDay())
    ).length;
    if (weekendDays > 0) {
      if (weekendRule.adjType === 'fixed_per_day') {
        weekendAmount = applyAdj(0, 'fixed_per_day', weekendRule.adjValue, weekendDays);
      } else {
        weekendAmount = applyAdj(dayPrice * weekendDays, 'percent', weekendRule.adjValue);
      }
      if (weekendAmount !== 0) {
        lines.push({
          code: `weekend_${weekendRule.id || 'rule'}`,
          label: weekendRule.name || 'Weekend',
          amount: weekendAmount,
          type: 'surcharge',
        });
      }
    }
  }

  return { seasonalAmount, weekendAmount, lines };
}

module.exports = {
  listChargeDates,
  dateInSeason,
  applySeasonalAndWeekendAdjustments,
};
