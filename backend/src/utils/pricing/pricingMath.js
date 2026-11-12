/**
 * Shared numeric helpers for money rounding and percent/fixed adjustments.
 * All money amounts in the pricing engine are EUR rounded to two decimal places.
 */

/**
 * Round to two decimal places (EUR cents).
 * Uses Number.EPSILON before scaling so values like 1.005 do not drift below the half-cent boundary.
 *
 * @param {number|string} n - Raw amount (coerced with Number)
 * @returns {number} Amount rounded to 2 decimal places
 * @throws {never}
 */
function round2(n) {
  // Scale to cents, round half-up via Math.round, then restore euros and normalize with toFixed.
  return Number((Math.round((Number(n) + Number.EPSILON) * 100) / 100).toFixed(2));
}

/**
 * Apply a pricing adjustment to a base amount.
 * - `fixed_per_day`: adjValue × days
 * - `fixed`: adjValue as a flat amount
 * - `percent` (default): base × adjValue / 100
 *
 * @param {number} base - Amount the percent adjustment is computed against
 * @param {'fixed_per_day' | 'fixed' | 'percent' | string} adjType - Adjustment mode
 * @param {number|string} adjValue - Raw adjustment value from pricing config
 * @param {number} [days=1] - Day count used only for `fixed_per_day`
 * @returns {number} Rounded adjustment amount (always non-negative for the raw adj; sign is applied by callers)
 * @throws {never}
 */
function applyAdj(base, adjType, adjValue, days = 1) {
  // Coerce missing/invalid config values to 0 so callers never get NaN lines.
  const value = Number(adjValue) || 0;
  if (adjType === 'fixed_per_day') return round2(value * days);
  if (adjType === 'fixed') return round2(value);
  // Default: percent of base (seasonal, weekend, discount rules).
  return round2((base * value) / 100);
}

module.exports = {
  round2,
  applyAdj,
};
