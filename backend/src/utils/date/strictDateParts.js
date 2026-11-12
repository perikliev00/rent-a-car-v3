/**
 * Strict calendar/time parsing: reject impossible dates and non-canonical inputs.
 * Used before timezone conversion so invalid days (e.g. Feb 30) never become Dates.
 */

const DATE_PARTS_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
// Create the time parts re constant.
const TIME_PARTS_RE = /^(\d{2}):(\d{2})$/;
// Create the combined datetime re constant.
const COMBINED_DATETIME_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/;
// Destructure object properties into local variables.
const { toHHMM } = require('./normalizeTime');

/**
 * Gregorian leap-year test (divisible by 4, except centuries not divisible by 400).
 *
 * @param {number} year - Full year (e.g. 2024)
 * @returns {boolean}
 * @throws {never}
 */
function isLeapYear(year) {
  // Return the resulting value to the caller.
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
  // Evaluate the condition and enter the branch when it is true.
  if (month === 2) {
    // Return the resulting value to the caller.
    return isLeapYear(year) ? 29 : 28;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    // Return the resulting value to the caller.
    return 30;
  }

  // Return the resulting value to the caller.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(year)) {
    // Return the resulting value to the caller.
    return false;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    // Return the resulting value to the caller.
    return false;
  }

  // Day must exist in that month (rejects Feb 30, Apr 31, etc.).
  if (!Number.isInteger(day) || day < 1 || day > daysInMonth(year, month)) {
    // Return the resulting value to the caller.
    return false;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    // Return the resulting value to the caller.
    return false;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    // Return the resulting value to the caller.
    return false;
  }

  // Return the resulting value to the caller.
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
  // Return control to the caller with the following value.
  return (
    // Call date.getUTCFullYear to perform this step.
    date.getUTCFullYear() === year &&
    // Call date.getUTCMonth to perform this step.
    date.getUTCMonth() === month - 1 &&
    // Call date.getUTCDate to perform this step.
    date.getUTCDate() === day &&
    // Call date.getUTCHours to perform this step.
    date.getUTCHours() === hour &&
    // Call date.getUTCMinutes to perform this step.
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
    // Return the resulting value to the caller.
    return null;
  }

  // Create the date input constant.
  const dateInput = String(dateString).trim();
  // Create the time input constant.
  const timeInput = String(timeString ?? '00:00').trim();
  // Prefer normalized HH:MM; fall back to raw trimmed time for regex match.
  const normalizedTimeInput = toHHMM(timeInput) ?? timeInput;

  // Reserve the year str variable for later assignment.
  let yearStr;
  // Reserve the month str variable for later assignment.
  let monthStr;
  // Reserve the day str variable for later assignment.
  let dayStr;
  // Reserve the hour str variable for later assignment.
  let hourStr;
  // Reserve the minute str variable for later assignment.
  let minuteStr;

  // Prefer combined datetime form when present (time in the string wins).
  const combinedMatch = COMBINED_DATETIME_RE.exec(dateInput);
  // Evaluate the condition and enter the branch when it is true.
  if (combinedMatch) {
    // Continue the surrounding logic with this statement.
    [, yearStr, monthStr, dayStr, hourStr, minuteStr] = combinedMatch;
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Date-only + separate time string.
    const dateMatch = DATE_PARTS_RE.exec(dateInput);
    // Create the time match constant.
    const timeMatch = TIME_PARTS_RE.exec(normalizedTimeInput);

    // Evaluate the condition and enter the branch when it is true.
    if (!dateMatch || !timeMatch) {
      // Return the resulting value to the caller.
      return null;
    }

    // Continue the surrounding logic with this statement.
    [, yearStr, monthStr, dayStr] = dateMatch;
    // Continue the surrounding logic with this statement.
    [, hourStr, minuteStr] = timeMatch;
  }

  // Create the year constant.
  const year = Number(yearStr);
  // Create the month constant.
  const month = Number(monthStr);
  // Create the day constant.
  const day = Number(dayStr);
  // Create the hour constant.
  const hour = Number(hourStr);
  // Create the minute constant.
  const minute = Number(minuteStr);

  // Reject impossible calendar combinations before constructing a Date.
  if (!validateCalendarDateTimeParts({ year, month, day, hour, minute })) {
    // Return the resulting value to the caller.
    return null;
  }

  // Baseline is "as if UTC" — timezone helpers subtract Sofia offset later.
  const baseline = new Date(Date.UTC(year, month - 1, day, hour, minute));

  // Guard against Date overflow/underflow changing components.
  if (!utcDateMatchesParts(baseline, year, month, day, hour, minute)) {
    // Return the resulting value to the caller.
    return null;
  }

  // Return the resulting value to the caller.
  return { year, month, day, hour, minute, baseline };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  DATE_PARTS_RE,
  // Contribute this line to the enclosing declaration or statement.
  TIME_PARTS_RE,
  // Contribute this line to the enclosing declaration or statement.
  COMBINED_DATETIME_RE,
  // Contribute this line to the enclosing declaration or statement.
  validateCalendarDateTimeParts,
  // Contribute this line to the enclosing declaration or statement.
  utcDateMatchesParts,
  // Contribute this line to the enclosing declaration or statement.
  parseStrictDateTimeInput,
};
