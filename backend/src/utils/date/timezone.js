/**
 * Europe/Sofia timezone helpers for booking calendars and UTC conversion.
 * Wall-clock dates are interpreted in Sofia, then converted to absolute Date instants.
 */

const { parseStrictDateTimeInput } = require('./strictDateParts');

/** IANA timezone used for all customer-facing booking dates. */
const SOFIA_TZ = 'Europe/Sofia';

/**
 * Offset (minutes) of `timeZone` relative to UTC at the given instant.
 * Positive means the zone is ahead of UTC (e.g. Sofia in winter ≈ +120).
 *
 * @param {string} timeZone - IANA zone id
 * @param {Date} date - Instant at which the offset is evaluated (DST-aware)
 * @returns {number} Offset in minutes, or 0 if formatToParts yields NaN components
 * @throws {never}
 */
function getOffsetMinutes(timeZone, date) {
  // Format the instant in the target zone to recover wall-clock Y/M/D/H/M/S.
  const dtf = new Intl.DateTimeFormat('en-US', {
    // Contribute this line to the enclosing declaration or statement.
    timeZone,
    // Provide the year field value.
    year: 'numeric',
    // Provide the month field value.
    month: '2-digit',
    // Provide the day field value.
    day: '2-digit',
    // Provide the hour field value.
    hour: '2-digit',
    // Provide the minute field value.
    minute: '2-digit',
    // Provide the second field value.
    second: '2-digit',
    // Provide the hour12 field value.
    hour12: false,
  });

  // Create the parts constant.
  const parts = dtf.formatToParts(date);
  // Create the data constant.
  const data = {};
  // Iterate using the loop initializer, condition, and step.
  for (const { type, value } of parts) {
    // Update data[type] with the right-hand side value.
    data[type] = value;
  }

  // Create the year constant.
  const year = Number(data.year);
  // Create the month constant.
  const month = Number(data.month);
  // Create the day constant.
  const day = Number(data.day);
  // Create the hour constant.
  const hour = Number(data.hour);
  // Create the minute constant.
  const minute = Number(data.minute);
  // Create the second constant.
  const second = Number(data.second);

  // Malformed parts → treat as UTC (offset 0) rather than throwing.
  if ([year, month, day, hour, minute, second].some(Number.isNaN)) {
    // Return the resulting value to the caller.
    return 0;
  }

  // Difference between "wall clock as UTC" and the true instant = zone offset.
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
  // Return the resulting value to the caller.
  return (asUTC - date.getTime()) / 60000;
}

/**
 * Calendar Y/M/D parts for a Date as seen in Sofia.
 *
 * @param {Date} [date=new Date()] - Instant to project onto the Sofia calendar
 * @returns {{ year: number, month: number, day: number }}
 * @throws {never}
 */
function getSofiaCalendarParts(date = new Date()) {
  // Create the dtf constant.
  const dtf = new Intl.DateTimeFormat('en-US', {
    // Provide the time zone field value.
    timeZone: SOFIA_TZ,
    // Provide the year field value.
    year: 'numeric',
    // Provide the month field value.
    month: '2-digit',
    // Provide the day field value.
    day: '2-digit',
  });

  // Create the parts constant.
  const parts = dtf.formatToParts(date);
  // Create the data constant.
  const data = {};
  // Iterate using the loop initializer, condition, and step.
  for (const { type, value } of parts) {
    // Update data[type] with the right-hand side value.
    data[type] = value;
  }

  // Return the resulting value to the caller.
  return {
    // Provide the year field value.
    year: Number(data.year),
    // Provide the month field value.
    month: Number(data.month),
    // Provide the day field value.
    day: Number(data.day),
  };
}

/**
 * Format calendar parts as an ISO date string.
 *
 * @param {{ year: number, month: number, day: number }} parts
 * @returns {string} `YYYY-MM-DD`
 * @throws {never}
 */
function formatSofiaIsoDateFromParts({ year, month, day }) {
  // Return the resulting value to the caller.
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/**
 * Today's Sofia calendar date as `YYYY-MM-DD`.
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 * @throws {never}
 */
function getSofiaIsoDateString(date = new Date()) {
  // Return the resulting value to the caller.
  return formatSofiaIsoDateFromParts(getSofiaCalendarParts(date));
}

/**
 * Add whole calendar days on the Sofia date grid (DST-safe via UTC date arithmetic).
 *
 * @param {Date} [date=new Date()] - Reference instant
 * @param {number} [days=1] - Whole days to add (may be negative)
 * @returns {{ year: number, month: number, day: number }}
 * @throws {never}
 */
function addSofiaCalendarDays(date = new Date(), days = 1) {
  // Project to Sofia Y/M/D, then add days on a UTC midnight proxy (avoids DST hour gaps).
  const { year, month, day } = getSofiaCalendarParts(date);
  // Create the utc constant.
  const utc = new Date(Date.UTC(year, month - 1, day));
  // Call utc.setUTCDate to perform this step.
  utc.setUTCDate(utc.getUTCDate() + days);
  // Return the resulting value to the caller.
  return {
    // Provide the year field value.
    year: utc.getUTCFullYear(),
    // Provide the month field value.
    month: utc.getUTCMonth() + 1,
    // Provide the day field value.
    day: utc.getUTCDate(),
  };
}

/**
 * Tomorrow's Sofia calendar date as `YYYY-MM-DD`.
 *
 * @param {Date} [date=new Date()]
 * @returns {string}
 * @throws {never}
 */
function getTomorrowSofiaIsoDate(date = new Date()) {
  // Return the resulting value to the caller.
  return formatSofiaIsoDateFromParts(addSofiaCalendarDays(date, 1));
}

/**
 * Start of "today" in Sofia as an absolute Date (midnight Sofia).
 *
 * @param {Date} [now=new Date()]
 * @returns {Date | null}
 * @throws {never}
 */
function getTodayInSofia(now = new Date()) {
  // Return the resulting value to the caller.
  return parseSofiaDate(getSofiaIsoDateString(now), '00:00');
}

/**
 * Interpret a Sofia wall-clock date/time and return the corresponding UTC Date.
 *
 * @param {string} dateString - `YYYY-MM-DD` or combined datetime
 * @param {string} [timeString='00:00'] - Used when dateString is date-only
 * @returns {Date | null} Absolute instant, or null when the input is invalid
 * @throws {never}
 */
function parseSofiaDate(dateString, timeString = '00:00') {
  // Strict parse first so impossible calendar days never reach offset math.
  const parsed = parseStrictDateTimeInput(dateString, timeString);
  // Evaluate the condition and enter the branch when it is true.
  if (!parsed) {
    // Return the resulting value to the caller.
    return null;
  }

  // baseline is "wall clock as UTC"; subtract Sofia offset to get the real instant.
  const offset = getOffsetMinutes(SOFIA_TZ, parsed.baseline);
  // Return the resulting value to the caller.
  return new Date(parsed.baseline.getTime() - offset * 60000);
}

/**
 * Normalize any date-like value to a UTC Date with the same UTC components.
 *
 * @param {string | number | Date} date - Value accepted by the Date constructor
 * @returns {Date} New Date built via Date.UTC from the input's UTC fields
 * @throws {never} Invalid inputs yield an Invalid Date (caller must check)
 */
function toUtc(date) {
  // Create the d constant.
  const d = new Date(date);
  // Return the resulting value to the caller.
  return new Date(
    // Call Date.UTC to perform this step.
    Date.UTC(
      // Call d.getUTCFullYear to perform this step.
      d.getUTCFullYear(),
      // Call d.getUTCMonth to perform this step.
      d.getUTCMonth(),
      // Call d.getUTCDate to perform this step.
      d.getUTCDate(),
      // Call d.getUTCHours to perform this step.
      d.getUTCHours(),
      // Call d.getUTCMinutes to perform this step.
      d.getUTCMinutes(),
      // Call d.getUTCSeconds to perform this step.
      d.getUTCSeconds(),
      // Call d.getUTCMilliseconds to perform this step.
      d.getUTCMilliseconds()
    )
  );
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  SOFIA_TZ,
  // Contribute this line to the enclosing declaration or statement.
  getSofiaCalendarParts,
  // Contribute this line to the enclosing declaration or statement.
  getSofiaIsoDateString,
  // Contribute this line to the enclosing declaration or statement.
  getTomorrowSofiaIsoDate,
  // Contribute this line to the enclosing declaration or statement.
  getTodayInSofia,
  // Contribute this line to the enclosing declaration or statement.
  parseSofiaDate,
  // Contribute this line to the enclosing declaration or statement.
  addSofiaCalendarDays,
  // Contribute this line to the enclosing declaration or statement.
  formatSofiaIsoDateFromParts,
  // Contribute this line to the enclosing declaration or statement.
  toUtc,
};
