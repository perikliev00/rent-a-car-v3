/**
 * Base daily rate selection from car price tiers and the base rental line item.
 * Tier fields win when any tier is set; otherwise the car's flat `price` is used.
 */

const { round2 } = require('./pricingMath');

/**
 * Pick the applicable daily rate from tier fields or fall back to `car.price`.
 * Tiers: 1–3 days → priceTier_1_3; 4–31 → priceTier_7_31; 32+ → priceTier_31_plus.
 *
 * @param {object | null | undefined} car - Car row with optional tier prices and `price`
 * @param {number} rentalDays - Charged rental day count (minimum 1 in the engine)
 * @returns {number} Daily rate in EUR (0 when car is missing)
 * @throws {never}
 */
function computeDayPrice(car, rentalDays) {
  // No car → zero day rate (callers treat this as an empty rental).
  if (!car) return 0;

  // Create the t1 constant.
  const t1 = car.priceTier_1_3;
  // Create the t7 constant.
  const t7 = car.priceTier_7_31;
  // Create the t31 constant.
  const t31 = car.priceTier_31_plus;

  // When any tier is populated, select by rental length; fall back to flat price if a band is empty.
  if (t1 || t7 || t31) {
    // Evaluate the condition and enter the branch when it is true.
    if (rentalDays <= 3 && t1) return t1;
    // Evaluate the condition and enter the branch when it is true.
    if (rentalDays <= 31 && t7) return t7;
    // Evaluate the condition and enter the branch when it is true.
    if (rentalDays > 31 && t31) return t31;
    // Return the resulting value to the caller.
    return car.price || 0;
  }

  // No tiers configured: use the single daily price field.
  return car.price || 0;
}

/**
 * Build the base rental amount and its breakdown line (dayPrice × rentalDays).
 *
 * @param {{ dayPrice: number, rentalDays: number }} params
 * @param {number} params.dayPrice - Daily rate from {@link computeDayPrice}
 * @param {number} params.rentalDays - Number of charged days
 * @returns {{ baseAmount: number, line: { code: string, label: string, amount: number, type: string } }}
 * @throws {never}
 */
function buildBaseRentalLine({ dayPrice, rentalDays }) {
  // Round the product so downstream subtotals stay on cent boundaries.
  const baseAmount = round2(dayPrice * rentalDays);
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    baseAmount,
    // Provide the line field value.
    line: {
      // Provide the code field value.
      code: 'base_rental',
      // Provide the label field value.
      label: `Base rental (${rentalDays} day${rentalDays === 1 ? '' : 's'} × €${dayPrice})`,
      // Provide the amount field value.
      amount: baseAmount,
      // Provide the type field value.
      type: 'base',
    },
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  computeDayPrice,
  // Contribute this line to the enclosing declaration or statement.
  buildBaseRentalLine,
};
