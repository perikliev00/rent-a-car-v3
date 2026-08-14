const RESERVATION_HOLD_MINUTES = 35;
/** Stripe requires Checkout Session expires_at to be at least 30 minutes from creation. */
const STRIPE_CHECKOUT_EXPIRES_MINUTES = 30;
const STRIPE_CHECKOUT_MIN_EXPIRES_MINUTES = 30;

function assertCheckoutExpiresBeforeHold(
  checkoutMinutes = STRIPE_CHECKOUT_EXPIRES_MINUTES,
  holdMinutes = RESERVATION_HOLD_MINUTES
) {
  if (checkoutMinutes < STRIPE_CHECKOUT_MIN_EXPIRES_MINUTES) {
    throw new Error(
      `STRIPE_CHECKOUT_EXPIRES_MINUTES (${checkoutMinutes}) must be at least ${STRIPE_CHECKOUT_MIN_EXPIRES_MINUTES} (Stripe minimum).`
    );
  }
  if (checkoutMinutes >= holdMinutes) {
    throw new Error(
      `STRIPE_CHECKOUT_EXPIRES_MINUTES (${checkoutMinutes}) must be less than RESERVATION_HOLD_MINUTES (${holdMinutes}).`
    );
  }
}

assertCheckoutExpiresBeforeHold();

const HOLD_WINDOW_MS = RESERVATION_HOLD_MINUTES * 60 * 1000;

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
