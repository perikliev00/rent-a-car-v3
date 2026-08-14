const { FEES, feeFor } = require('./calculateFees');
const {
  computeDayPrice,
  computeBookingPrice,
  computeBookingPriceAsync,
  computePrice,
  normalizeSelectedExtras,
} = require('./calculateRentalPrice');

module.exports = {
  FEES,
  feeFor,
  computeDayPrice,
  computeBookingPrice,
  computeBookingPriceAsync,
  computePrice,
  normalizeSelectedExtras,
};
