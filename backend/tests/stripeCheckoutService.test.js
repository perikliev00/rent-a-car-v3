jest.mock('../src/config/stripe', () => ({
  checkout: {
    sessions: {
      create: jest.fn().mockResolvedValue({ id: 'cs_test_123', url: 'https://stripe.test/checkout' }),
    },
  },
}));

// Unit tests must hit the real Stripe client mock, not the in-memory stub.
delete process.env.STRIPE_STUB;

const stripe = require('../src/config/stripe');
const { createStripeCheckoutSession } = require('../src/services/payment/stripeCheckoutService');
const {
  getStripeCheckoutExpiresAt,
  STRIPE_CHECKOUT_EXPIRES_MINUTES,
  RESERVATION_HOLD_MINUTES,
} = require('../src/config/reservationTiming');

describe('createStripeCheckoutSession', () => {
  const baseArgs = {
    req: {
      protocol: 'http',
      get: jest.fn().mockReturnValue('localhost:3000'),
    },
    car: { name: 'BMW X5' },
    pricing: { totalPrice: 120.5 },
    reservationId: '42',
    carId: '7',
    sessionId: 'sess_abc',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('includes expires_at on the Stripe Checkout Session', async () => {
    const nowMs = 1_700_000_000_000;
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);

    await createStripeCheckoutSession(baseArgs);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        expires_at: getStripeCheckoutExpiresAt(nowMs),
      })
    );

    dateNowSpy.mockRestore();
  });

  test('stripe session expiration ends before reservation hold expiration', async () => {
    const nowMs = 1_700_000_000_000;
    const checkoutExpiresAt = getStripeCheckoutExpiresAt(nowMs);
    const holdExpiresAt = Math.floor(nowMs / 1000) + RESERVATION_HOLD_MINUTES * 60;

    expect(STRIPE_CHECKOUT_EXPIRES_MINUTES).toBeLessThan(RESERVATION_HOLD_MINUTES);
    expect(checkoutExpiresAt).toBeLessThan(holdExpiresAt);
  });

  test('uses frontend checkout redirect URLs instead of backend host', async () => {
    await createStripeCheckoutSession(baseArgs);

    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        success_url:
          'http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}',
        cancel_url:
          'http://localhost:5173/checkout/cancel?session_id={CHECKOUT_SESSION_ID}',
      })
    );
  });
});
