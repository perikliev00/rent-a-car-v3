/**
 * Assemble the price result object (lines, totals, snapshot) returned by the pricing engine.
 * The snapshot is persisted with the reservation so later admin views match the charged quote.
 */

const { round2 } = require('./pricingMath');

/**
 * Empty zeroed result used when rental days are not positive.
 *
 * @returns {{
 *   currency: string,
 *   rentalDays: number,
 *   dayPrice: number,
 *   unitPrice: number,
 *   deliveryPrice: number,
 *   returnPrice: number,
 *   lines: never[],
 *   totalPrice: number,
 *   deposit: number,
 *   priceBreakdown: { lines: never[], totalPrice: number, deposit: number, currency: string },
 *   snapshot: null
 * }}
 * @throws {never}
 */
function buildEmptyPriceResult() {
  // All monetary fields zeroed; snapshot omitted so callers do not persist an empty quote.
  return {
    currency: 'EUR',
    rentalDays: 0,
    dayPrice: 0,
    unitPrice: 0,
    deliveryPrice: 0,
    returnPrice: 0,
    lines: [],
    totalPrice: 0,
    deposit: 0,
    priceBreakdown: { lines: [], totalPrice: 0, deposit: 0, currency: 'EUR' },
    snapshot: null,
  };
}

/**
 * Sum line amounts and attach a persistable pricing snapshot.
 * Deposit is included in the result but is not part of totalPrice.
 *
 * @param {object} params
 * @param {number} params.rentalDays - Charged day count
 * @param {number} params.dayPrice - Daily rate used for the quote
 * @param {number} params.deliveryPrice - Pickup-location delivery fee
 * @param {number} params.returnPrice - Return-location delivery fee
 * @param {Array<{ code: string, label: string, amount: number, type: string }>} params.lines - All priced lines
 * @param {number} params.deposit - Security deposit (not in totalPrice)
 * @param {string} params.pickupLocation - Pickup location key
 * @param {string} params.returnLocation - Return location key
 * @param {boolean} params.hotelDelivery - Whether hotel delivery was selected
 * @param {string[]} params.selectedExtras - Normalized extra codes
 * @param {boolean} params.lateReturn - Whether late-return fee applies
 * @param {boolean} params.fuelFee - Whether fuel fee applies
 * @param {Date|string|number} params.bookedAt - Booking instant for the snapshot
 * @returns {object} Full pricing result with `totalPrice`, `priceBreakdown`, and `snapshot`
 * @throws {never}
 */
function buildPriceResult({
  rentalDays,
  dayPrice,
  deliveryPrice,
  returnPrice,
  lines,
  deposit,
  pickupLocation,
  returnLocation,
  hotelDelivery,
  selectedExtras,
  lateReturn,
  fuelFee,
  bookedAt,
}) {
  // Sum every line amount (base, surcharges, fees, discounts) and round the total.
  const totalPrice = round2(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));

  // Snapshot captures inputs + lines for audit / re-display after config changes.
  const snapshot = {
    currency: 'EUR',
    rentalDays,
    dayPrice,
    pickupLocation,
    returnLocation,
    hotelDelivery: Boolean(hotelDelivery),
    selectedExtras,
    lateReturn: Boolean(lateReturn),
    fuelFee: Boolean(fuelFee),
    bookedAt: (bookedAt instanceof Date ? bookedAt : new Date()).toISOString(),
    lines,
    totalPrice,
    deposit,
    deliveryPrice,
    returnPrice,
  };

  return {
    currency: 'EUR',
    rentalDays,
    dayPrice,
    unitPrice: dayPrice,
    deliveryPrice,
    returnPrice,
    lines,
    totalPrice,
    deposit,
    priceBreakdown: { lines, totalPrice, deposit, currency: 'EUR' },
    snapshot,
  };
}

module.exports = {
  buildEmptyPriceResult,
  buildPriceResult,
};
