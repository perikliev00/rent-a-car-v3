/**
 * Apply long-rental, early-booking, and last-minute discount/surcharge lines.
 * Discounts apply to the rental subtotal only (base + seasonal + weekend),
 * never to delivery, extras, late-return, or fuel fees.
 */

const { round2, applyAdj } = require('./pricingMath');

/**
 * Evaluate active discount rules in fixed order and emit priced lines.
 * Order: long_rental → early_booking → last_minute (each may add at most one line).
 *
 * @param {object} params
 * @param {object} params.cfg - Pricing config with `discountRules`
 * @param {number} params.rentalSubtotal - Base + seasonal + weekend (discount base)
 * @param {number} params.rentalDays - Charged rental days
 * @param {Date} params.start - Pickup instant
 * @param {Date} params.bookedAt - When the booking was placed (for lead-time rules)
 * @returns {{ lines: Array<{ code: string, label: string, amount: number, type: string }> }}
 * @throws {never}
 */
function applyDiscountLines({ cfg, rentalSubtotal, rentalDays, start, bookedAt }) {
  // Create the lines constant.
  const lines = [];

  // Lead time in whole days from booking instant to pickup (floor, can be negative if past).
  const daysUntilPickup = Math.floor(
    // Continue the surrounding logic with this statement.
    (start.getTime() - (bookedAt instanceof Date ? bookedAt.getTime() : Date.now())) /
      // Continue the surrounding logic with this statement.
      (24 * 60 * 60 * 1000)
  );

  // Fixed evaluation order so stacked rules are deterministic.
  const discountKinds = ['long_rental', 'early_booking', 'last_minute'];
  // Iterate using the loop initializer, condition, and step.
  for (const kind of discountKinds) {
    // Only the first active rule of each kind is considered.
    const rule = (cfg.discountRules || []).find((r) => r.kind === kind && r.active);
    // Evaluate the condition and enter the branch when it is true.
    if (!rule) continue;

    // Threshold semantics differ by kind (days rented vs days until pickup).
    let applies = false;
    // Evaluate the condition and enter the branch when it is true.
    if (kind === 'long_rental') applies = rentalDays >= rule.threshold;
    // Evaluate the condition and enter the branch when it is true.
    if (kind === 'early_booking') applies = daysUntilPickup >= rule.threshold;
    // Evaluate the condition and enter the branch when it is true.
    if (kind === 'last_minute') applies = daysUntilPickup <= rule.threshold && daysUntilPickup >= 0;

    // Evaluate the condition and enter the branch when it is true.
    if (!applies) continue;

    // Config adjType is either fixed or percent of rentalSubtotal.
    let amount = applyAdj(rentalSubtotal, rule.adjType === 'fixed' ? 'fixed' : 'percent', rule.adjValue);
    // long + early are discounts (negative); last_minute is surcharge (positive)
    if (kind === 'long_rental' || kind === 'early_booking') {
      // Update amount with the right-hand side value.
      amount = -Math.abs(amount);
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Update amount with the right-hand side value.
      amount = Math.abs(amount);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (amount === 0) continue;
    // Call lines.push to perform this step.
    lines.push({
      // Provide the code field value.
      code: `discount_${kind}`,
      // Provide the label field value.
      label: rule.name,
      // Provide the amount field value.
      amount: round2(amount),
      // Provide the type field value.
      type: kind === 'last_minute' ? 'surcharge' : 'discount',
    });
  }

  // Return the resulting value to the caller.
  return { lines };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  applyDiscountLines,
};
