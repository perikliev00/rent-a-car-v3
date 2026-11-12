// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  canLinkNewStripeSession,
  // Contribute this line to the enclosing declaration or statement.
  validateActiveStripeSessionLink,
  // Contribute this line to the enclosing declaration or statement.
  getExpectedStripeAmountCents,
  // Contribute this line to the enclosing declaration or statement.
  validateStripePaymentDetails,
  // Contribute this line to the enclosing declaration or statement.
  buildStripeSessionSnapshot,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/payment/stripeSessionValidation');

// Declare a test suite grouping related cases.
describe('stripeSessionValidation', () => {
  // Define a single test case and its expectations.
  test('canLinkNewStripeSession allows pending and processing statuses', () => {
    // Assert that the value matches the intended expectation.
    expect(canLinkNewStripeSession({ status: 'pending_payment' })).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(canLinkNewStripeSession({ status: 'confirmed' })).toBe(false);
  });

  // Define a single test case and its expectations.
  test('validateActiveStripeSessionLink detects stale session mismatch', () => {
    // Create the result constant.
    const result = validateActiveStripeSessionLink(
      // Contribute this line to the enclosing declaration or statement.
      { stripeSessionId: 'cs_old' },
      // Supply the literal value used by the enclosing expression.
      'cs_new'
    );

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({
      // Provide the ok field value.
      ok: false,
      // Provide the reason field value.
      reason: 'stale_stripe_session',
      // Provide the active session id field value.
      activeSessionId: 'cs_old',
      // Provide the incoming session id field value.
      incomingSessionId: 'cs_new',
    });
  });

  // Define a single test case and its expectations.
  test('validateActiveStripeSessionLink allows orphan recovery', () => {
    // Assert that the value matches the intended expectation.
    expect(validateActiveStripeSessionLink({ stripeSessionId: null }, 'cs_new')).toEqual({
      // Provide the ok field value.
      ok: true,
      // Provide the orphan recovery field value.
      orphanRecovery: true,
    });
  });

  // Define a single test case and its expectations.
  test('getExpectedStripeAmountCents rounds total price', () => {
    // Assert that the value matches the intended expectation.
    expect(getExpectedStripeAmountCents({ totalPrice: 120.5 })).toBe(12050);
  });

  // Define a single test case and its expectations.
  test('validateStripePaymentDetails rejects amount mismatch', () => {
    // Create the result constant.
    const result = validateStripePaymentDetails(
      // Contribute this line to the enclosing declaration or statement.
      { amount_total: 10000, currency: 'eur' },
      // Contribute this line to the enclosing declaration or statement.
      { totalPrice: 120 }
    );

    // Assert that the value matches the intended expectation.
    expect(result.ok).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(result.reason).toBe('stripe_amount_mismatch');
  });

  // Define a single test case and its expectations.
  test('buildStripeSessionSnapshot returns null for missing session', () => {
    // Assert that the value matches the intended expectation.
    expect(buildStripeSessionSnapshot(null)).toBeNull();
  });
});
