const { round2, applyAdj } = require('./pricingMath');

function applyDiscountLines({ cfg, rentalSubtotal, rentalDays, start, bookedAt }) {
  const lines = [];

  // Discounts / last-minute on rentalSubtotal only (order: long → early → last_minute)
  const daysUntilPickup = Math.floor(
    (start.getTime() - (bookedAt instanceof Date ? bookedAt.getTime() : Date.now())) /
      (24 * 60 * 60 * 1000)
  );

  const discountKinds = ['long_rental', 'early_booking', 'last_minute'];
  for (const kind of discountKinds) {
    const rule = (cfg.discountRules || []).find((r) => r.kind === kind && r.active);
    if (!rule) continue;

    let applies = false;
    if (kind === 'long_rental') applies = rentalDays >= rule.threshold;
    if (kind === 'early_booking') applies = daysUntilPickup >= rule.threshold;
    if (kind === 'last_minute') applies = daysUntilPickup <= rule.threshold && daysUntilPickup >= 0;

    if (!applies) continue;

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
