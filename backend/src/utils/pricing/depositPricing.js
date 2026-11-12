/**
 * Resolve the active security-deposit rule amount from pricing config.
 * Deposit is returned separately from totalPrice and is not summed into the rental total.
 */

const { round2 } = require('./pricingMath');

/**
 * Find the first active deposit rule in the pricing config.
 *
 * @param {object} config - Pricing config with optional `depositRules` array
 * @returns {object | null} Active deposit rule, or null when none is active
 * @throws {never}
 */
function activeDeposit(config) {
  // First active rule wins; inactive rules are ignored.
  return (config.depositRules || []).find((d) => d.active) || null;
}

/**
 * Resolve the rounded security-deposit amount for a booking.
 *
 * @param {object} cfg - Pricing config (same shape as {@link activeDeposit})
 * @returns {number} Rounded deposit amount in EUR, or 0 when no active rule
 * @throws {never}
 */
function resolveDeposit(cfg) {
  // Look up the active rule, then round defaultAmount to cents.
  const depositRule = activeDeposit(cfg);
  return depositRule ? round2(depositRule.defaultAmount) : 0;
}

module.exports = {
  activeDeposit,
  resolveDeposit,
};
