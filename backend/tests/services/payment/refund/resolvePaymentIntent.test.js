jest.mock('../../../../src/services/payment/stripeCheckoutService', () => ({
  retrieveStripeCheckoutSession: jest.fn(),
  retrieveStripePaymentIntent: jest.fn(),
}));

const {
  retrieveStripeCheckoutSession,
  retrieveStripePaymentIntent,
} = require('../../../../src/services/payment/stripeCheckoutService');
const {
  resolvePaymentIntentForReservation,
} = require('../../../../src/services/payment/refund/resolvePaymentIntent');

function paidPaymentIntent({ amount = 10000, refunded = 0, currency = 'eur' } = {}) {
  return {
    id: 'pi_stored',
    amount,
    amount_received: amount,
    currency,
    latest_charge: {
      id: 'ch_1',
      amount,
      amount_captured: amount,
      amount_refunded: refunded,
      currency,
    },
  };
}

describe('resolvePaymentIntentForReservation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('stored PI retrieves remaining refundable amount from Stripe', async () => {
    retrieveStripePaymentIntent.mockResolvedValue(
      paidPaymentIntent({ amount: 12000, refunded: 0 })
    );

    const result = await resolvePaymentIntentForReservation({
      stripePaymentIntentId: 'pi_stored',
      stripeSessionId: 'cs_x',
      totalPrice: 50,
    });

    expect(result).toEqual({
      paymentIntentId: 'pi_stored',
      amountCents: 12000,
      currency: 'eur',
      source: 'stripe_pi',
      paidAmountCents: 12000,
    });
    expect(retrieveStripeCheckoutSession).not.toHaveBeenCalled();
  });

  test('stored PI remaining ignores a lower mutable totalPrice', async () => {
    retrieveStripePaymentIntent.mockResolvedValue(
      paidPaymentIntent({ amount: 10000, refunded: 2000 })
    );

    const result = await resolvePaymentIntentForReservation({
      stripePaymentIntentId: 'pi_stored',
      totalPrice: 40,
    });

    expect(result.amountCents).toBe(8000);
    expect(result.paidAmountCents).toBe(10000);
    expect(result.source).toBe('stripe_pi');
  });

  test('retrieve failure falls back to paidAmountCents, never totalPrice', async () => {
    retrieveStripePaymentIntent.mockRejectedValue(new Error('stripe down'));

    const result = await resolvePaymentIntentForReservation({
      stripePaymentIntentId: 'pi_stored',
      paidAmountCents: 10000,
      paidCurrency: 'eur',
      totalPrice: 40,
    });

    expect(result).toEqual({
      paymentIntentId: 'pi_stored',
      amountCents: 10000,
      currency: 'eur',
      source: 'snapshot',
      paidAmountCents: 10000,
    });
  });

  test('retrieve failure without snapshot throws REFUND_NO_AMOUNT', async () => {
    retrieveStripePaymentIntent.mockRejectedValue(new Error('stripe down'));

    await expect(
      resolvePaymentIntentForReservation({
        stripePaymentIntentId: 'pi_stored',
        totalPrice: 40,
      })
    ).rejects.toMatchObject({
      code: 'REFUND_NO_AMOUNT',
      status: 422,
    });
  });

  test('falls back to checkout session when PI is missing and PaymentIntent retrieve fails', async () => {
    retrieveStripeCheckoutSession.mockResolvedValue({
      payment_intent: 'pi_from_session',
      amount_total: 5500,
      currency: 'eur',
    });
    retrieveStripePaymentIntent.mockRejectedValue(new Error('no such pi'));

    const result = await resolvePaymentIntentForReservation({
      stripeSessionId: 'cs_test',
      totalPrice: 10,
    });

    expect(result.paymentIntentId).toBe('pi_from_session');
    expect(result.amountCents).toBe(5500);
    expect(result.paidAmountCents).toBe(5500);
    expect(result.source).toBe('checkout_session');
  });

  test('remaining zero is returned so callers can skip a new Stripe refund', async () => {
    retrieveStripePaymentIntent.mockResolvedValue(
      paidPaymentIntent({ amount: 10000, refunded: 10000 })
    );

    const result = await resolvePaymentIntentForReservation({
      stripePaymentIntentId: 'pi_stored',
      paidAmountCents: 10000,
    });

    expect(result.amountCents).toBe(0);
    expect(result.source).toBe('stripe_pi');
  });

  test('throws REFUND_NO_PAYMENT_INTENT when neither available', async () => {
    await expect(resolvePaymentIntentForReservation({})).rejects.toMatchObject({
      code: 'REFUND_NO_PAYMENT_INTENT',
      status: 422,
    });
  });
});
