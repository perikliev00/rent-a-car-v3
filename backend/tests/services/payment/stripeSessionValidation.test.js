const {
  canLinkNewStripeSession,
  validateActiveStripeSessionLink,
  getExpectedStripeAmountCents,
  validateStripePaymentDetails,
  buildStripeSessionSnapshot,
} = require('../../../src/services/payment/stripeSessionValidation');

describe('stripeSessionValidation', () => {
  test('canLinkNewStripeSession allows pending and processing statuses', () => {
    expect(canLinkNewStripeSession({ status: 'pending_payment' })).toBe(true);
    expect(canLinkNewStripeSession({ status: 'confirmed' })).toBe(false);
  });

  test('validateActiveStripeSessionLink detects stale session mismatch', () => {
    const result = validateActiveStripeSessionLink(
      { stripeSessionId: 'cs_old' },
      'cs_new'
    );

    expect(result).toEqual({
      ok: false,
      reason: 'stale_stripe_session',
      activeSessionId: 'cs_old',
      incomingSessionId: 'cs_new',
    });
  });

  test('validateActiveStripeSessionLink allows orphan recovery', () => {
    expect(validateActiveStripeSessionLink({ stripeSessionId: null }, 'cs_new')).toEqual({
      ok: true,
      orphanRecovery: true,
    });
  });

  test('getExpectedStripeAmountCents rounds total price', () => {
    expect(getExpectedStripeAmountCents({ totalPrice: 120.5 })).toBe(12050);
  });

  test('validateStripePaymentDetails rejects amount mismatch', () => {
    const result = validateStripePaymentDetails(
      { amount_total: 10000, currency: 'eur' },
      { totalPrice: 120 }
    );

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('stripe_amount_mismatch');
  });

  test('buildStripeSessionSnapshot returns null for missing session', () => {
    expect(buildStripeSessionSnapshot(null)).toBeNull();
  });
});
