/**
 * Re-export of booking date validation from the date parsing helpers.
 */
const { validateBookingDates } = require('./date/parseBookingDateTime');

module.exports = {
  validateBookingDates,
};
