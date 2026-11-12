const {
  RESERVATION_HOLD_MINUTES,
  STRIPE_CHECKOUT_EXPIRES_MINUTES,
  assertCheckoutExpiresBeforeHold,
  getStripeCheckoutExpiresAt,
} = require('../src/config/reservationTiming');

describe('reservationTiming config', () => {
  test('stripe checkout expiration is before hold expiration', () => {
    expect(STRIPE_CHECKOUT_EXPIRES_MINUTES).toBeLessThan(RESERVATION_HOLD_MINUTES);
  });

  test('getStripeCheckoutExpiresAt is before hold window end', () => {
    const nowMs = 1_700_000_000_000;
    const checkoutExpiresAt = getStripeCheckoutExpiresAt(nowMs);
    const holdExpiresAt = Math.floor(nowMs / 1000) + RESERVATION_HOLD_MINUTES * 60;

    expect(checkoutExpiresAt).toBeLessThan(holdExpiresAt);
    expect(checkoutExpiresAt).toBe(
      Math.floor(nowMs / 1000) + STRIPE_CHECKOUT_EXPIRES_MINUTES * 60
    );
  });

  test('invalid config throws a clear error', () => {
    expect(() => assertCheckoutExpiresBeforeHold(25, 35)).toThrow(
      /must be at least 30 \(Stripe minimum\)/
    );
    expect(() => assertCheckoutExpiresBeforeHold(35, 30)).toThrow(
      'STRIPE_CHECKOUT_EXPIRES_MINUTES (35) must be less than RESERVATION_HOLD_MINUTES (30).'
    );
    expect(() => assertCheckoutExpiresBeforeHold(30, 30)).toThrow(
      /STRIPE_CHECKOUT_EXPIRES_MINUTES .* must be less than RESERVATION_HOLD_MINUTES/
    );
  });

  test('stripe checkout expires at least 30 minutes from creation', () => {
    expect(STRIPE_CHECKOUT_EXPIRES_MINUTES).toBeGreaterThanOrEqual(30);
  });
});
