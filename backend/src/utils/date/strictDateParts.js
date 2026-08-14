const DATE_PARTS_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PARTS_RE = /^(\d{2}):(\d{2})$/;
const COMBINED_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
const { toHHMM } = require('./normalizeTime');

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function daysInMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }

  return 31;
}

function validateCalendarDateTimeParts({ year, month, day, hour, minute }) {
  if (!Number.isInteger(year)) {
    return false;
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }

  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
    return false;
  }

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return false;
  }

  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return false;
  }

  return true;
}

function utcDateMatchesParts(date, year, month, day, hour, minute) {
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
}

function parseStrictDateTimeInput(dateString, timeString = '00:00') {
  if (dateString === undefined || dateString === null || dateString === '') {
    return null;
  }

  const dateInput = String(dateString).trim();
  const timeInput = String(timeString ?? '00:00').trim();
  const normalizedTimeInput = toHHMM(timeInput) ?? timeInput;

  let yearStr;
  let monthStr;
  let dayStr;
  let hourStr;
  let minuteStr;

  const combinedMatch = COMBINED_DATETIME_RE.exec(dateInput);
  if (combinedMatch) {
    [, yearStr, monthStr, dayStr, hourStr, minuteStr] = combinedMatch;
  } else {
    const dateMatch = DATE_PARTS_RE.exec(dateInput);
    const timeMatch = TIME_PARTS_RE.exec(normalizedTimeInput);

    if (!dateMatch || !timeMatch) {
      return null;
    }

    [, yearStr, monthStr, dayStr] = dateMatch;
    [, hourStr, minuteStr] = timeMatch;
  }

  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const hour = Number(hourStr);
  const minute = Number(minuteStr);

  if (!validateCalendarDateTimeParts({ year, month, day, hour, minute })) {
    return null;
  }

  const baseline = new Date(Date.UTC(year, month - 1, day, hour, minute));

  if (!utcDateMatchesParts(baseline, year, month, day, hour, minute)) {
    return null;
  }

  return { year, month, day, hour, minute, baseline };
}

module.exports = {
  DATE_PARTS_RE,
  TIME_PARTS_RE,
  COMBINED_DATETIME_RE,
  validateCalendarDateTimeParts,
  utcDateMatchesParts,
  parseStrictDateTimeInput,
};
