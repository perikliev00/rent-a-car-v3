/**
 * Strict calendar/time parsing: reject impossible dates and non-canonical inputs.
 * Used before timezone conversion so invalid days (e.g. Feb 30) never become Dates.
 */

const DATE_PARTS_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_PARTS_RE = /^(\d{2}):(\d{2})$/;
const COMBINED_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
const { toHHMM } = require('./normalizeTime');

/**
 * Gregorian leap-year test (divisible by 4, except centuries not divisible by 400).
 *
 * @param {number} year - Full year (e.g. 2024)
 * @returns {boolean}
 * @throws {never}
 */
function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Number of days in a given calendar month (accounts for leap February).
 *
 * @param {number} year - Full year (needed for February)
 * @param {number} month - 1–12
 * @returns {number} Days in that month (28–31)
 * @throws {never}
 */
function daysInMonth(year, month) {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }

  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }

  return 31;
}

/**
 * Validate integer Y/M/D/H/M parts against calendar reality and 24h clock ranges.
 *
 * @param {{ year: number, month: number, day: number, hour: number, minute: number }} parts
 * @returns {boolean} True when every part is an integer in a valid range
 * @throws {never}
 */
function validateCalendarDateTimeParts({ year, month, day, hour, minute }) {
  if (!Number.isInteger(year)) {
    return false;
  }

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }

  // Day must exist in that month (rejects Feb 30, Apr 31, etc.).
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

/**
 * Confirm a UTC Date still matches the intended Y/M/D/H/M parts (guards JS Date overflow).
 *
 * @param {Date} date - Candidate UTC Date built from parts
 * @param {number} year
 * @param {number} month - 1–12
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @returns {boolean}
 * @throws {never}
 */
function utcDateMatchesParts(date, year, month, day, hour, minute) {
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCHours() === hour &&
    date.getUTCMinutes() === minute
  );
}

/**
 * Parse a date string (and optional time) into validated calendar parts plus a UTC baseline Date.
 *
 * @param {string | null | undefined} dateString - `YYYY-MM-DD` or `YYYY-MM-DD[T ]HH:MM`
 * @param {string} [timeString='00:00'] - Used when dateString is date-only
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, baseline: Date } | null}
 * @throws {never} Invalid input returns null
 */
function parseStrictDateTimeInput(dateString, timeString = '00:00') {
  // Empty / missing date → unparseable.
  if (dateString === undefined || dateString === null || dateString === '') {
    return null;
  }

  const dateInput = String(dateString).trim();
  const timeInput = String(timeString ?? '00:00').trim();
  // Prefer normalized HH:MM; fall back to raw trimmed time for regex match.
  const normalizedTimeInput = toHHMM(timeInput) ?? timeInput;

  let yearStr;
  let monthStr;
  let dayStr;
  let hourStr;
  let minuteStr;

  // Prefer combined datetime form when present (time in the string wins).
  const combinedMatch = COMBINED_DATETIME_RE.exec(dateInput);
  if (combinedMatch) {
    [, yearStr, monthStr, dayStr, hourStr, minuteStr] = combinedMatch;
  } else {
    // Date-only + separate time string.
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

  // Reject impossible calendar combinations before constructing a Date.
  if (!validateCalendarDateTimeParts({ year, month, day, hour, minute })) {
    return null;
  }

  // Baseline is "as if UTC" — timezone helpers subtract Sofia offset later.
  const baseline = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Guard against Date overflow/underflow changing components.
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
