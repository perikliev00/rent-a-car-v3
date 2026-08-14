/**
 * Normalize a time string to zero-padded HH:MM, or null if invalid.
 *
 * @param {unknown} value
 * @returns {string | null}
 */
function toHHMM(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const input = String(value).trim();
  if (!input) {
    return null;
  }

  if (/^\d{2}:\d{2}$/.test(input)) {
    return input;
  }

  const match = input.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    return null;
  }
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) {
    return null;
  }

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

module.exports = { toHHMM };
