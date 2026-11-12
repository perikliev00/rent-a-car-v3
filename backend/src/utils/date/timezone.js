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

  // Malformed parts → treat as UTC (offset 0) rather than throwing.
  if ([year, month, day, hour, minute, second].some(Number.isNaN)) {
    return 0;
  }

  // Difference between "wall clock as UTC" and the true instant = zone offset.
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second);
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

/**
 * Format calendar parts as an ISO date string.
 *
 * @param {{ year: number, month: number, day: number }} parts
 * @returns {string} `YYYY-MM-DD`
 * @throws {never}
 */
function formatSofiaIsoDateFromParts({ year, month, day }) {
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
  const utc = new Date(Date.UTC(year, month - 1, day));
  utc.setUTCDate(utc.getUTCDate() + days);
  return {
    year: utc.getUTCFullYear(),
    month: utc.getUTCMonth() + 1,
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
  if (!parsed) {
    return null;
  }

  // baseline is "wall clock as UTC"; subtract Sofia offset to get the real instant.
  const offset = getOffsetMinutes(SOFIA_TZ, parsed.baseline);
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
