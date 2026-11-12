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
  const lines = [];

  // Lead time in whole days from booking instant to pickup (floor, can be negative if past).
  const daysUntilPickup = Math.floor(
    (start.getTime() - (bookedAt instanceof Date ? bookedAt.getTime() : Date.now())) /
      (24 * 60 * 60 * 1000)
  );

  // Fixed evaluation order so stacked rules are deterministic.
  const discountKinds = ['long_rental', 'early_booking', 'last_minute'];
  for (const kind of discountKinds) {
    // Only the first active rule of each kind is considered.
    const rule = (cfg.discountRules || []).find((r) => r.kind === kind && r.active);
    if (!rule) continue;

    // Threshold semantics differ by kind (days rented vs days until pickup).
    let applies = false;
    if (kind === 'long_rental') applies = rentalDays >= rule.threshold;
    if (kind === 'early_booking') applies = daysUntilPickup >= rule.threshold;
    if (kind === 'last_minute') applies = daysUntilPickup <= rule.threshold && daysUntilPickup >= 0;

    if (!applies) continue;

    // Config adjType is either fixed or percent of rentalSubtotal.
    let amount = applyAdj(rentalSubtotal, rule.adjType === 'fixed' ? 'fixed' : 'percent', rule.adjValue);
    // long + early are discounts (negative); last_minute is surcharge (positive)
    if (kind === 'long_rental' || kind === 'early_booking') {
      amount = -Math.abs(amount);
    } else {
      amount = Math.abs(amount);
    }
    if (amount === 0) continue;
    lines.push({
      code: `discount_${kind}`,
      label: rule.name,
      amount: round2(amount),
      type: kind === 'last_minute' ? 'surcharge' : 'discount',
    });
  }

  return { lines };
}

module.exports = {
  applyDiscountLines,
};
