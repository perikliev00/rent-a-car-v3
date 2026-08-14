const { round2, applyAdj } = require('./pricingMath');

function dayOfYearMonthDay(date) {
  return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function mdKey(month, day) {
  return month * 100 + day;
}

/**
 * Recurring MM-DD season window (supports wrap across year, e.g. Nov–Feb).
 */
function dateInSeason(date, season) {
  const { month, day } = dayOfYearMonthDay(date);
  const cur = mdKey(month, day);
  const start = mdKey(season.startMonth, season.startDay);
  const end = mdKey(season.endMonth, season.endDay);
  if (start <= end) return cur >= start && cur <= end;
  return cur >= start || cur <= end;
}

function listChargeDates(start, rentalDays) {
  const dates = [];
  if (!start || rentalDays <= 0) return dates;
  for (let i = 0; i < rentalDays; i += 1) {
    dates.push(
      new Date(
        Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i)
      )
    );
  }
  return dates;
}

function applySeasonalAndWeekendAdjustments({ cfg, start, rentalDays, dayPrice }) {
  const lines = [];
  const chargeDates = listChargeDates(start, rentalDays);

  // Seasonal: percent of base, or fixed_per_day × overlapping season days
  const activeSeasons = (cfg.seasons || []).filter((s) => s.active);
  let seasonalAmount = 0;
  for (const season of activeSeasons) {
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
