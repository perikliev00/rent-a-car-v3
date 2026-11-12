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
    // Provide the currency field value.
    currency: 'EUR',
    // Provide the rental days field value.
    rentalDays: 0,
    // Provide the day price field value.
    dayPrice: 0,
    // Provide the unit price field value.
    unitPrice: 0,
    // Provide the delivery price field value.
    deliveryPrice: 0,
    // Provide the return price field value.
    returnPrice: 0,
    // Provide the lines field value.
    lines: [],
    // Provide the total price field value.
    totalPrice: 0,
    // Provide the deposit field value.
    deposit: 0,
    // Provide the price breakdown field value.
    priceBreakdown: { lines: [], totalPrice: 0, deposit: 0, currency: 'EUR' },
    // Provide the snapshot field value.
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
  // Contribute this line to the enclosing declaration or statement.
  rentalDays,
  // Contribute this line to the enclosing declaration or statement.
  dayPrice,
  // Contribute this line to the enclosing declaration or statement.
  deliveryPrice,
  // Contribute this line to the enclosing declaration or statement.
  returnPrice,
  // Contribute this line to the enclosing declaration or statement.
  lines,
  // Contribute this line to the enclosing declaration or statement.
  deposit,
  // Contribute this line to the enclosing declaration or statement.
  pickupLocation,
  // Contribute this line to the enclosing declaration or statement.
  returnLocation,
  // Contribute this line to the enclosing declaration or statement.
  hotelDelivery,
  // Contribute this line to the enclosing declaration or statement.
  selectedExtras,
  // Contribute this line to the enclosing declaration or statement.
  lateReturn,
  // Contribute this line to the enclosing declaration or statement.
  fuelFee,
  // Contribute this line to the enclosing declaration or statement.
  bookedAt,
// Continue the surrounding logic with this statement.
}) {
  // Sum every line amount (base, surcharges, fees, discounts) and round the total.
  const totalPrice = round2(lines.reduce((sum, line) => sum + Number(line.amount || 0), 0));

  // Snapshot captures inputs + lines for audit / re-display after config changes.
  const snapshot = {
    // Provide the currency field value.
    currency: 'EUR',
    // Contribute this line to the enclosing declaration or statement.
    rentalDays,
    // Contribute this line to the enclosing declaration or statement.
    dayPrice,
    // Contribute this line to the enclosing declaration or statement.
    pickupLocation,
    // Contribute this line to the enclosing declaration or statement.
    returnLocation,
    // Provide the hotel delivery field value.
    hotelDelivery: Boolean(hotelDelivery),
    // Contribute this line to the enclosing declaration or statement.
    selectedExtras,
    // Provide the late return field value.
    lateReturn: Boolean(lateReturn),
    // Provide the fuel fee field value.
    fuelFee: Boolean(fuelFee),
    // Provide the booked at field value.
    bookedAt: (bookedAt instanceof Date ? bookedAt : new Date()).toISOString(),
    // Contribute this line to the enclosing declaration or statement.
    lines,
    // Contribute this line to the enclosing declaration or statement.
    totalPrice,
    // Contribute this line to the enclosing declaration or statement.
    deposit,
    // Contribute this line to the enclosing declaration or statement.
    deliveryPrice,
    // Contribute this line to the enclosing declaration or statement.
    returnPrice,
  };

  // Return the resulting value to the caller.
  return {
    // Provide the currency field value.
    currency: 'EUR',
    // Contribute this line to the enclosing declaration or statement.
    rentalDays,
    // Contribute this line to the enclosing declaration or statement.
    dayPrice,
    // Provide the unit price field value.
    unitPrice: dayPrice,
    // Contribute this line to the enclosing declaration or statement.
    deliveryPrice,
    // Contribute this line to the enclosing declaration or statement.
    returnPrice,
    // Contribute this line to the enclosing declaration or statement.
    lines,
    // Contribute this line to the enclosing declaration or statement.
    totalPrice,
    // Contribute this line to the enclosing declaration or statement.
    deposit,
    // Provide the price breakdown field value.
    priceBreakdown: { lines, totalPrice, deposit, currency: 'EUR' },
    // Contribute this line to the enclosing declaration or statement.
    snapshot,
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  buildEmptyPriceResult,
  // Contribute this line to the enclosing declaration or statement.
  buildPriceResult,
};
