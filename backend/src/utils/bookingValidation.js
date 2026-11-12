/**
 * Re-export of booking date validation from the date parsing helpers.
 */
const { validateBookingDates, isWithinRentalLimits } = require('./date/parseBookingDateTime');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  validateBookingDates,
  // Contribute this line to the enclosing declaration or statement.
  isWithinRentalLimits,
};
