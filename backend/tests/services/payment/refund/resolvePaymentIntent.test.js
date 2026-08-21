jest.mock('../../../../src/services/payment/stripeCheckoutService', () => ({
  retrieveStripeCheckoutSession: jest.fn(),
}));

const {
  retrieveStripeCheckoutSession,
} = require('../../../../src/services/payment/stripeCheckoutService');
const {
  resolvePaymentIntentForReservation,
} = require('../../../../src/services/payment/refund/resolvePaymentIntent');

describe('resolvePaymentIntentForReservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('prefers reservation stripePaymentIntentId', async () => {
    const result = await resolvePaymentIntentForReservation({
      stripePaymentIntentId: 'pi_stored',
      stripeSessionId: 'cs_x',
    });
    expect(result).toEqual({
      paymentIntentId: 'pi_stored',
      amountCents: null,
      currency: null,
      source: 'reservation',
    });
    expect(retrieveStripeCheckoutSession).not.toHaveBeenCalled();
  });

  test('falls back to checkout session retrieve', async () => {
    retrieveStripeCheckoutSession.mockResolvedValue({
      payment_intent: 'pi_from_session',
      amount_total: 5500,
      currency: 'eur',
    });

    const result = await resolvePaymentIntentForReservation({
      stripeSessionId: 'cs_test',
    });

    expect(result.paymentIntentId).toBe('pi_from_session');
    expect(result.amountCents).toBe(5500);
    expect(result.source).toBe('checkout_session');
  });

  test('throws REFUND_NO_PAYMENT_INTENT when neither available', async () => {
    await expect(resolvePaymentIntentForReservation({})).rejects.toMatchObject({
      code: 'REFUND_NO_PAYMENT_INTENT',
      status: 422,
    });
  });
});
