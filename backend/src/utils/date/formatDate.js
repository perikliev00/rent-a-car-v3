/**
 * Display formatting for dates and location names shown to end users.
 */

const { formatLocationName } = require('../../services/locationService');

/**
 * Format a date string as "D Mon YYYY" (e.g. "15 Oct 2026"), or return the input if unparsable.
 *
 * @param {string | Date | null | undefined} dateString - Value to format for UI display
 * @returns {string} Formatted local date, original string if invalid, or '' when empty
 * @throws {never}
 */
function formatDateForDisplay(dateString) {
  // Empty input → blank display string.
  if (!dateString) return '';

  // Parse with the Date constructor; invalid → echo the original input unchanged.
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  // Use local calendar components (not UTC) for customer-facing labels.
  const day = date.getDate();
  const month = months[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

module.exports = {
  formatDateForDisplay,
  formatLocationName,
};
