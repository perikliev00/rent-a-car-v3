const {
  formatSofiaIsoDateFromParts,
  addSofiaCalendarDays,
} = require('../../src/utils/date/timezone');

/** YYYY-MM-DD in Europe/Sofia, N calendar days from now (default tomorrow). */
function futureSofiaDate(daysAhead = 1) {
  return formatSofiaIsoDateFromParts(addSofiaCalendarDays(new Date(), daysAhead));
}

module.exports = { futureSofiaDate };
