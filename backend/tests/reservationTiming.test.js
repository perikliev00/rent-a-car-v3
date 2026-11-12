// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_HOLD_MINUTES,
  // Contribute this line to the enclosing declaration or statement.
  STRIPE_CHECKOUT_EXPIRES_MINUTES,
  // Contribute this line to the enclosing declaration or statement.
  assertCheckoutExpiresBeforeHold,
  // Contribute this line to the enclosing declaration or statement.
  getStripeCheckoutExpiresAt,
// Continue the surrounding logic with this statement.
} = require('../src/config/reservationTiming');

// Declare a test suite grouping related cases.
describe('reservationTiming config', () => {
  // Define a single test case and its expectations.
  test('stripe checkout expiration is before hold expiration', () => {
    // Assert that the value matches the intended expectation.
    expect(STRIPE_CHECKOUT_EXPIRES_MINUTES).toBeLessThan(RESERVATION_HOLD_MINUTES);
  });

  // Define a single test case and its expectations.
  test('getStripeCheckoutExpiresAt is before hold window end', () => {
    // Create the now ms constant.
    const nowMs = 1_700_000_000_000;
    // Create the checkout expires at constant.
    const checkoutExpiresAt = getStripeCheckoutExpiresAt(nowMs);
    // Create the hold expires at constant.
    const holdExpiresAt = Math.floor(nowMs / 1000) + RESERVATION_HOLD_MINUTES * 60;

    // Assert that the value matches the intended expectation.
    expect(checkoutExpiresAt).toBeLessThan(holdExpiresAt);
    // Assert that the value matches the intended expectation.
    expect(checkoutExpiresAt).toBe(
      // Call Math.floor to perform this step.
      Math.floor(nowMs / 1000) + STRIPE_CHECKOUT_EXPIRES_MINUTES * 60
    );
  });

  // Define a single test case and its expectations.
  test('invalid config throws a clear error', () => {
    // Assert that the value matches the intended expectation.
    expect(() => assertCheckoutExpiresBeforeHold(25, 35)).toThrow(
      // Continue the surrounding logic with this statement.
      /must be at least 30 \(Stripe minimum\)/
    );
    // Assert that the value matches the intended expectation.
    expect(() => assertCheckoutExpiresBeforeHold(35, 30)).toThrow(
      // Continue the surrounding logic with this statement.
      'STRIPE_CHECKOUT_EXPIRES_MINUTES (35) must be less than RESERVATION_HOLD_MINUTES (30).'
    );
    // Assert that the value matches the intended expectation.
    expect(() => assertCheckoutExpiresBeforeHold(30, 30)).toThrow(
      // Contribute this line to the enclosing declaration or statement.
      /STRIPE_CHECKOUT_EXPIRES_MINUTES .* must be less than RESERVATION_HOLD_MINUTES/
    );
  });

  // Define a single test case and its expectations.
  test('stripe checkout expires at least 30 minutes from creation', () => {
    // Assert that the value matches the intended expectation.
    expect(STRIPE_CHECKOUT_EXPIRES_MINUTES).toBeGreaterThanOrEqual(30);
  });
});
