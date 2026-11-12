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
  // Evaluate the condition and enter the branch when it is true.
  if (Number.isNaN(date.getTime())) return dateString;

  // Create the months constant.
  const months = [
    // Supply the literal value used by the enclosing expression.
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    // Supply the literal value used by the enclosing expression.
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  // Use local calendar components (not UTC) for customer-facing labels.
  const day = date.getDate();
  // Create the month constant.
  const month = months[date.getMonth()];
  // Create the year constant.
  const year = date.getFullYear();

  // Return the resulting value to the caller.
  return `${day} ${month} ${year}`;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  formatDateForDisplay,
  // Contribute this line to the enclosing declaration or statement.
  formatLocationName,
};
