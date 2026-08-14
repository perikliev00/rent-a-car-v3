const { parseStrictDateTimeInput } = require('./strictDateParts');

const SOFIA_TZ = 'Europe/Sofia';

function getOffsetMinutes(timeZone, date) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = dtf.formatToParts(date);
  const data = {};
  for (const { type, value } of parts) {
    data[type] = value;
  }

  const year = Number(data.year);
  const month = Number(data.month);
  const day = Number(data.day);
  const hour = Number(data.hour);
  const minute = Number(data.minute);
  const second = Number(data.second);

  if ([year, month, day, hour, minute, second].some(Number.isNaN)) {
    return 0;
  }

  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  return (asUTC - date.getTime()) / 60000;
}

function getSofiaCalendarParts(date = new Date()) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: SOFIA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = dtf.formatToParts(date);
  const data = {};
  for (const { type, value } of parts) {
    data[type] = value;
  }

  return {
    year: Number(data.year),
    month: Number(data.month),
    day: Number(data.day),
  };
}

function formatSofiaIsoDateFromParts({ year, month, day }) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function getSofiaIsoDateString(date = new Date()) {
  return formatSofiaIsoDateFromParts(getSofiaCalendarParts(date));
}

function addSofiaCalendarDays(date = new Date(), days = 1) {
  const { year, month, day } = getSofiaCalendarParts(date);
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
    day: utc.getUTCDate(),
  };
}

function getTomorrowSofiaIsoDate(date = new Date()) {
  return formatSofiaIsoDateFromParts(addSofiaCalendarDays(date, 1));
}

function getTodayInSofia(now = new Date()) {
  return parseSofiaDate(getSofiaIsoDateString(now), '00:00');
}

function parseSofiaDate(dateString, timeString = '00:00') {
  const parsed = parseStrictDateTimeInput(dateString, timeString);
  if (!parsed) {
    return null;
  }

  const offset = getOffsetMinutes(SOFIA_TZ, parsed.baseline);
  return new Date(parsed.baseline.getTime() - offset * 60000);
}

function toUtc(date) {
  const d = new Date(date);
  return new Date(
    Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
      d.getUTCMilliseconds()
    )
  );
}

module.exports = {
  SOFIA_TZ,
  getSofiaCalendarParts,
  getSofiaIsoDateString,
  getTomorrowSofiaIsoDate,
  getTodayInSofia,
  parseSofiaDate,
  addSofiaCalendarDays,
  formatSofiaIsoDateFromParts,
  toUtc,
};
