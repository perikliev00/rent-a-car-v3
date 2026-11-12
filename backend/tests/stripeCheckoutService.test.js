// Call jest.mock to perform this step.
jest.mock('../src/config/stripe', () => ({
  // Provide the checkout field value.
  checkout: {
    // Provide the sessions field value.
    sessions: {
      // Provide the create field value.
      create: jest.fn().mockResolvedValue({ id: 'cs_test_123', url: 'https://stripe.test/checkout' }),
    },
  },
}));

// Unit tests must hit the real Stripe client mock, not the in-memory stub.
delete process.env.STRIPE_STUB;

// Require the '../src/config/stripe' module as stripe.
const stripe = require('../src/config/stripe');
// Destructure object properties into local variables.
const { createStripeCheckoutSession } = require('../src/services/payment/stripeCheckoutService');
// Destructure object properties into local variables.
const { getStripeCheckoutExpiresAt } = require('../src/config/reservationTiming');

// Declare a test suite grouping related cases.
describe('createStripeCheckoutSession', () => {
  // Create the base args constant.
  const baseArgs = {
    // Provide the req field value.
    req: {
      // Provide the protocol field value.
      protocol: 'http',
      // Provide the get field value.
      get: jest.fn().mockReturnValue('localhost:3000'),
    },
    // Provide the car field value.
    car: { name: 'BMW X5' },
    // Provide the pricing field value.
    pricing: { totalPrice: 120.5 },
    // Provide the reservation id field value.
    reservationId: '42',
    // Provide the car id field value.
    carId: '7',
    // Provide the session id field value.
    sessionId: 'sess_abc',
    // Provide the idempotency key field value.
    idempotencyKey: 'checkout:reservation:42:attempt1',
  };

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('includes expires_at on the Stripe Checkout Session', async () => {
    // Create the now ms constant.
    const nowMs = 1_700_000_000_000;
    // Create the date now spy constant.
    const dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(nowMs);

    // Wait until the asynchronous operation resolves.
    await createStripeCheckoutSession(baseArgs);

    // Assert that the value matches the intended expectation.
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the expires at field value.
        expires_at: getStripeCheckoutExpiresAt(nowMs),
      }),
      // Contribute this line to the enclosing declaration or statement.
      { idempotencyKey: 'checkout:reservation:42:attempt1' }
    );

    // Call dateNowSpy.mockRestore to perform this step.
    dateNowSpy.mockRestore();
  });

  // Define a single test case and its expectations.
  test('uses frontend checkout redirect URLs instead of backend host', async () => {
    // Wait until the asynchronous operation resolves.
    await createStripeCheckoutSession(baseArgs);

    // Assert that the value matches the intended expectation.
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(
      // Call expect.objectContaining to perform this step.
      expect.objectContaining({
        // Provide the success url field value.
        success_url:
          // Continue the surrounding logic with this statement.
          'http://localhost:5173/checkout/success?session_id={CHECKOUT_SESSION_ID}',
        // Provide the cancel url field value.
        cancel_url:
          // Continue the surrounding logic with this statement.
          'http://localhost:5173/checkout/cancel?session_id={CHECKOUT_SESSION_ID}',
      }),
      // Contribute this line to the enclosing declaration or statement.
      { idempotencyKey: 'checkout:reservation:42:attempt1' }
    );
  });

  // Define a single test case and its expectations.
  test('requires an idempotency key', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(
      // Call createStripeCheckoutSession to perform this step.
      createStripeCheckoutSession({
        // Spread baseArgs into the surrounding structure.
        ...baseArgs,
        // Provide the idempotency key field value.
        idempotencyKey: undefined,
      })
    // Continue the surrounding logic with this statement.
    ).rejects.toThrow('idempotencyKey is required');
    // Assert that the value matches the intended expectation.
    expect(stripe.checkout.sessions.create).not.toHaveBeenCalled();
  });
});
