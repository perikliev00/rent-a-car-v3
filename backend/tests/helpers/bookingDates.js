// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  formatSofiaIsoDateFromParts,
  // Contribute this line to the enclosing declaration or statement.
  addSofiaCalendarDays,
// Continue the surrounding logic with this statement.
} = require('../../src/utils/date/timezone');

/** YYYY-MM-DD in Europe/Sofia, N calendar days from now (default tomorrow). */
function futureSofiaDate(daysAhead = 1) {
  // Return the resulting value to the caller.
  return formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), daysAhead));
}

// Assign the CommonJS module exports.
module.exports = { futureSofiaDate };
