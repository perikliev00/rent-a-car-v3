// Require the '../../../src/services/payment/stripeTestStub' module as stripeTestStub.
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createRefund,
  // Contribute this line to the enclosing declaration or statement.
  retrieveRefund,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/payment/stripeRefundService');

// Declare a test suite grouping related cases.
describe('stripeRefundService (stub)', () => {
  // Create the prev stub constant.
  const prevStub = process.env.STRIPE_STUB;

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Update process.env.STRIPE_STUB with the right-hand side value.
    process.env.STRIPE_STUB = '1';
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Register cleanup that runs after the tests.
  afterAll(() => {
    // Update process.env.STRIPE_STUB with the right-hand side value.
    process.env.STRIPE_STUB = prevStub;
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define a single test case and its expectations.
  test('creates and retrieves a succeeded refund', async () => {
    // Create the session constant.
    const session = await stripeTestStub.createSession({
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the pricing field value.
      pricing: { totalPrice: 120 },
    });

    // Create the refund constant.
    const refund = await createRefund({
      // Provide the payment intent id field value.
      paymentIntentId: session.payment_intent,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:test:1',
    });

    // Assert that the value matches the intended expectation.
    expect(refund.status).toBe('succeeded');
    // Assert that the value matches the intended expectation.
    expect(refund.payment_intent).toBe(session.payment_intent);
    // Assert that the value matches the intended expectation.
    expect(refund.amount).toBe(12000);

    // Create the again constant.
    const again = await createRefund({
      // Provide the payment intent id field value.
      paymentIntentId: session.payment_intent,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:test:1',
    });
    // Assert that the value matches the intended expectation.
    expect(again.id).toBe(refund.id);

    // Create the retrieved constant.
    const retrieved = await retrieveRefund(refund.id);
    // Assert that the value matches the intended expectation.
    expect(retrieved.id).toBe(refund.id);
  });

  // Define a single test case and its expectations.
  test('failNextCreateRefund throws once', async () => {
    // Call stripeTestStub.failNextCreateRefund to perform this step.
    stripeTestStub.failNextCreateRefund();
    // Wait until the asynchronous operation resolves.
    await expect(
      // Call createRefund to perform this step.
      createRefund({
        // Provide the payment intent id field value.
        paymentIntentId: 'pi_fail',
        // Provide the idempotency key field value.
        idempotencyKey: 'refund:fail:1',
      })
    // Continue the surrounding logic with this statement.
    ).rejects.toThrow(/forced refund failure/);

    // Create the refund constant.
    const refund = await createRefund({
      // Provide the payment intent id field value.
      paymentIntentId: 'pi_fail',
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:fail:2',
    });
    // Assert that the value matches the intended expectation.
    expect(refund.status).toBe('succeeded');
  });

  // Define a single test case and its expectations.
  test('setNextRefundStatus pending', async () => {
    // Call stripeTestStub.setNextRefundStatus to perform this step.
    stripeTestStub.setNextRefundStatus('pending');
    // Create the refund constant.
    const refund = await createRefund({
      // Provide the payment intent id field value.
      paymentIntentId: 'pi_pending',
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:pending:1',
    });
    // Assert that the value matches the intended expectation.
    expect(refund.status).toBe('pending');
  });
});
