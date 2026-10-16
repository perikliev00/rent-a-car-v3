/**
 * Reservation hold vs Stripe Checkout expiry timing constants.
 * Checkout must expire before the inventory hold so unpaid carts release cleanly
 * (session ends → webhook/cleanup can free the car before hold cleanup races).
 */
/** Minutes a pending reservation holds the car before cleanup can release it. */
const RESERVATION_HOLD_MINUTES = 35;
/** Stripe requires Checkout Session expires_at to be at least 30 minutes from creation. */
const STRIPE_CHECKOUT_EXPIRES_MINUTES = 30;
/** Stripe platform minimum; kept as a named constant for the assert below. */
const STRIPE_CHECKOUT_MIN_EXPIRES_MINUTES = 30;

/**
 * Invariant: checkout expiry ≥ Stripe minimum and strictly less than the hold window.
 * Side effects: none (pure validation); throws on violation.
 * @param {number} [checkoutMinutes] - Checkout Session lifetime in minutes
 * @param {number} [holdMinutes] - Reservation inventory hold in minutes
 * @returns {void}
 * @throws {Error} When checkout is below Stripe minimum or not strictly before hold
 */
function assertCheckoutExpiresBeforeHold(
  checkoutMinutes = STRIPE_CHECKOUT_EXPIRES_MINUTES,
  holdMinutes = RESERVATION_HOLD_MINUTES
) {
  if (checkoutMinutes < STRIPE_CHECKOUT_MIN_EXPIRES_MINUTES) {
    throw new Error(
      `STRIPE_CHECKOUT_EXPIRES_MINUTES (${checkoutMinutes}) must be at least ${STRIPE_CHECKOUT_MIN_EXPIRES_MINUTES} (Stripe minimum).`
    );
  }
  // Hold must outlive checkout so expiry webhook / cleanup has a clear window.
  if (checkoutMinutes >= holdMinutes) {
    throw new Error(
      `STRIPE_CHECKOUT_EXPIRES_MINUTES (${checkoutMinutes}) must be less than RESERVATION_HOLD_MINUTES (${holdMinutes}).`
    );
  }
}

// Fail at module load if constants ever drift into an invalid relationship.
assertCheckoutExpiresBeforeHold();

/** Hold duration in milliseconds (derived from `RESERVATION_HOLD_MINUTES`). */
const HOLD_WINDOW_MS = RESERVATION_HOLD_MINUTES * 60 * 1000;

/**
 * Unix seconds timestamp for Stripe Checkout Session `expires_at`.
 * @param {number} [nowMs=Date.now()] - Current time in milliseconds
 * @returns {number} Unix timestamp in seconds for Stripe `expires_at`
 */
function getStripeCheckoutExpiresAt(nowMs = Date.now()) {
  return Math.floor(nowMs / 1000) + STRIPE_CHECKOUT_EXPIRES_MINUTES * 60;
}

module.exports = {
  RESERVATION_HOLD_MINUTES,
  STRIPE_CHECKOUT_EXPIRES_MINUTES,
  STRIPE_CHECKOUT_MIN_EXPIRES_MINUTES,
  HOLD_WINDOW_MS,
  assertCheckoutExpiresBeforeHold,
  getStripeCheckoutExpiresAt,
};
