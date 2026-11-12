/**
 * Public barrel for pricing helpers (fees + rental price computation).
 */

const { FEES, feeFor } = require('./calculateFees');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  computeDayPrice,
  // Contribute this line to the enclosing declaration or statement.
  computeBookingPrice,
  // Contribute this line to the enclosing declaration or statement.
  computeBookingPriceAsync,
  // Contribute this line to the enclosing declaration or statement.
  computePrice,
  // Contribute this line to the enclosing declaration or statement.
  normalizeSelectedExtras,
// Continue the surrounding logic with this statement.
} = require('./calculateRentalPrice');

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  FEES,
  // Contribute this line to the enclosing declaration or statement.
  feeFor,
  // Contribute this line to the enclosing declaration or statement.
  computeDayPrice,
  // Contribute this line to the enclosing declaration or statement.
  computeBookingPrice,
  // Contribute this line to the enclosing declaration or statement.
  computeBookingPriceAsync,
  // Contribute this line to the enclosing declaration or statement.
  computePrice,
  // Contribute this line to the enclosing declaration or statement.
  normalizeSelectedExtras,
};
