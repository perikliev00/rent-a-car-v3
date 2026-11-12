/**
 * Time-string normalization for booking pick-up/return fields.
 * Accepts H:MM or HH:MM and returns canonical zero-padded HH:MM.
 */

/**
 * Normalize a time string to zero-padded HH:MM, or null if invalid.
 *
 * @param {unknown} value - Raw time from query/body (string, number, etc.)
 * @returns {string | null} Canonical `HH:MM`, or null when empty/unparseable/out of range
 * @throws {never}
 */
function toHHMM(value) {
  // Treat undefined / null / empty as "no time provided".
  if (value === undefined || value === null || value === '') {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the input constant.
  const input = String(value).trim();
  // Evaluate the condition and enter the branch when it is true.
  if (!input) {
    // Return the resulting value to the caller.
    return null;
  }

  // Already canonical HH:MM — accept as-is (does not re-validate ranges).
  if (/^\d{2}:\d{2}$/.test(input)) {
    // Return the resulting value to the caller.
    return input;
  }

  // Allow single-digit hour (e.g. "9:30") then validate ranges.
  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  // Evaluate the condition and enter the branch when it is true.
  if (!match) {
    // Return the resulting value to the caller.
    return null;
  }

  // Create the hour constant.
  const hour = Number(match[1]);
  // Create the minute constant.
  const minute = Number(match[2]);
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    // Return the resulting value to the caller.
    return null;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    // Return the resulting value to the caller.
    return null;
  }

  // Zero-pad hour to two digits for storage / comparison.
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

// Assign the CommonJS module exports.
module.exports = { toHHMM };
