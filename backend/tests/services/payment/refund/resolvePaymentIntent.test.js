// Call jest.mock to perform this step.
jest.mock('../../../../src/services/payment/stripeCheckoutService', () => ({
  // Provide the retrieve stripe checkout session field value.
  retrieveStripeCheckoutSession: jest.fn(),
  // Provide the retrieve stripe payment intent field value.
  retrieveStripePaymentIntent: jest.fn(),
}));

// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  retrieveStripeCheckoutSession,
  // Contribute this line to the enclosing declaration or statement.
  retrieveStripePaymentIntent,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/stripeCheckoutService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  resolvePaymentIntentForReservation,
// Continue the surrounding logic with this statement.
} = require('../../../../src/services/payment/refund/resolvePaymentIntent');

// Define the paidPaymentIntent function.
function paidPaymentIntent({ amount = 10000, refunded = 0, currency = 'eur' } = {}) {
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: 'pi_stored',
    // Contribute this line to the enclosing declaration or statement.
    amount,
    // Provide the amount received field value.
    amount_received: amount,
    // Contribute this line to the enclosing declaration or statement.
    currency,
    // Provide the latest charge field value.
    latest_charge: {
      // Provide the id field value.
      id: 'ch_1',
      // Contribute this line to the enclosing declaration or statement.
      amount,
      // Provide the amount captured field value.
      amount_captured: amount,
      // Provide the amount refunded field value.
      amount_refunded: refunded,
      // Contribute this line to the enclosing declaration or statement.
      currency,
    },
  };
}

// Declare a test suite grouping related cases.
describe('resolvePaymentIntentForReservation', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('stored PI retrieves remaining refundable amount from Stripe', async () => {
    // Call retrieveStripePaymentIntent.mockResolvedValue to perform this step.
    retrieveStripePaymentIntent.mockResolvedValue(
      // Call paidPaymentIntent to perform this step.
      paidPaymentIntent({ amount: 12000, refunded: 0 })
    );

    // Create the result constant.
    const result = await resolvePaymentIntentForReservation({
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_stored',
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_x',
      // Provide the total price field value.
      totalPrice: 50,
    });

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({
      // Provide the payment intent id field value.
      paymentIntentId: 'pi_stored',
      // Provide the amount cents field value.
      amountCents: 12000,
      // Provide the currency field value.
      currency: 'eur',
      // Provide the source field value.
      source: 'stripe_pi',
      // Provide the paid amount cents field value.
      paidAmountCents: 12000,
    });
    // Assert that the value matches the intended expectation.
    expect(retrieveStripeCheckoutSession).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('stored PI remaining ignores a lower mutable totalPrice', async () => {
    // Call retrieveStripePaymentIntent.mockResolvedValue to perform this step.
    retrieveStripePaymentIntent.mockResolvedValue(
      // Call paidPaymentIntent to perform this step.
      paidPaymentIntent({ amount: 10000, refunded: 2000 })
    );

    // Create the result constant.
    const result = await resolvePaymentIntentForReservation({
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_stored',
      // Provide the total price field value.
      totalPrice: 40,
    });

    // Assert that the value matches the intended expectation.
    expect(result.amountCents).toBe(8000);
    // Assert that the value matches the intended expectation.
    expect(result.paidAmountCents).toBe(10000);
    // Assert that the value matches the intended expectation.
    expect(result.source).toBe('stripe_pi');
  });

  // Define a single test case and its expectations.
  test('retrieve failure falls back to paidAmountCents, never totalPrice', async () => {
    // Call retrieveStripePaymentIntent.mockRejectedValue to perform this step.
    retrieveStripePaymentIntent.mockRejectedValue(new Error('stripe down'));

    // Create the result constant.
    const result = await resolvePaymentIntentForReservation({
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_stored',
      // Provide the paid amount cents field value.
      paidAmountCents: 10000,
      // Provide the paid currency field value.
      paidCurrency: 'eur',
      // Provide the total price field value.
      totalPrice: 40,
    });

    // Assert that the value matches the intended expectation.
    expect(result).toEqual({
      // Provide the payment intent id field value.
      paymentIntentId: 'pi_stored',
      // Provide the amount cents field value.
      amountCents: 10000,
      // Provide the currency field value.
      currency: 'eur',
      // Provide the source field value.
      source: 'snapshot',
      // Provide the paid amount cents field value.
      paidAmountCents: 10000,
    });
  });

  // Define a single test case and its expectations.
  test('retrieve failure without snapshot throws REFUND_NO_AMOUNT', async () => {
    // Call retrieveStripePaymentIntent.mockRejectedValue to perform this step.
    retrieveStripePaymentIntent.mockRejectedValue(new Error('stripe down'));

    // Wait until the asynchronous operation resolves.
    await expect(
      // Call resolvePaymentIntentForReservation to perform this step.
      resolvePaymentIntentForReservation({
        // Provide the stripe payment intent id field value.
        stripePaymentIntentId: 'pi_stored',
        // Provide the total price field value.
        totalPrice: 40,
      })
    // Continue the surrounding logic with this statement.
    ).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_NO_AMOUNT',
      // Provide the status field value.
      status: 422,
    });
  });

  // Define a single test case and its expectations.
  test('falls back to checkout session when PI is missing and PaymentIntent retrieve fails', async () => {
    // Call retrieveStripeCheckoutSession.mockResolvedValue to perform this step.
    retrieveStripeCheckoutSession.mockResolvedValue({
      // Provide the payment intent field value.
      payment_intent: 'pi_from_session',
      // Provide the amount total field value.
      amount_total: 5500,
      // Provide the currency field value.
      currency: 'eur',
    });
    // Call retrieveStripePaymentIntent.mockRejectedValue to perform this step.
    retrieveStripePaymentIntent.mockRejectedValue(new Error('no such pi'));

    // Create the result constant.
    const result = await resolvePaymentIntentForReservation({
      // Provide the stripe session id field value.
      stripeSessionId: 'cs_test',
      // Provide the total price field value.
      totalPrice: 10,
    });

    // Assert that the value matches the intended expectation.
    expect(result.paymentIntentId).toBe('pi_from_session');
    // Assert that the value matches the intended expectation.
    expect(result.amountCents).toBe(5500);
    // Assert that the value matches the intended expectation.
    expect(result.paidAmountCents).toBe(5500);
    // Assert that the value matches the intended expectation.
    expect(result.source).toBe('checkout_session');
  });

  // Define a single test case and its expectations.
  test('remaining zero is returned so callers can skip a new Stripe refund', async () => {
    // Call retrieveStripePaymentIntent.mockResolvedValue to perform this step.
    retrieveStripePaymentIntent.mockResolvedValue(
      // Call paidPaymentIntent to perform this step.
      paidPaymentIntent({ amount: 10000, refunded: 10000 })
    );

    // Create the result constant.
    const result = await resolvePaymentIntentForReservation({
      // Provide the stripe payment intent id field value.
      stripePaymentIntentId: 'pi_stored',
      // Provide the paid amount cents field value.
      paidAmountCents: 10000,
    });

    // Assert that the value matches the intended expectation.
    expect(result.amountCents).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(result.source).toBe('stripe_pi');
  });

  // Define a single test case and its expectations.
  test('throws REFUND_NO_PAYMENT_INTENT when neither available', async () => {
    // Wait until the asynchronous operation resolves.
    await expect(resolvePaymentIntentForReservation({})).rejects.toMatchObject({
      // Provide the code field value.
      code: 'REFUND_NO_PAYMENT_INTENT',
      // Provide the status field value.
      status: 422,
    });
  });
});
