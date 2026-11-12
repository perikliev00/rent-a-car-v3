// Require the '../../../src/services/payment/stripeTestStub' module as stripeTestStub.
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

// Declare a test suite grouping related cases.
describe('H-06: controllable Stripe stub', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Update process.env.STRIPE_STUB with the right-hand side value.
    process.env.STRIPE_STUB = '1';
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define a single test case and its expectations.
  test('creates open unpaid sessions by default', async () => {
    // Create the session constant.
    const session = await stripeTestStub.createSession({
      // Provide the reservation id field value.
      reservationId: 1,
      // Provide the car id field value.
      carId: 2,
      // Provide the session id field value.
      sessionId: 'sess',
      // Provide the pricing field value.
      pricing: { totalPrice: 100 },
    });

    // Assert that the value matches the intended expectation.
    expect(session.payment_status).toBe('unpaid');
    // Assert that the value matches the intended expectation.
    expect(session.status).toBe('open');
    // Assert that the value matches the intended expectation.
    expect(session.amount_total).toBe(10000);
    // Assert that the value matches the intended expectation.
    expect(session.currency).toBe('eur');
    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.retrieveSession(session.id).payment_status).toBe('unpaid');
  });

  // Define a single test case and its expectations.
  test('supports paid / expired / amount-currency overrides', async () => {
    // Call stripeTestStub.setNextCreateOverrides to perform this step.
    stripeTestStub.setNextCreateOverrides({
      // Provide the payment status field value.
      paymentStatus: 'unpaid',
      // Provide the status field value.
      status: 'open',
      // Provide the amount total field value.
      amountTotal: 12345,
      // Provide the currency field value.
      currency: 'usd',
    });
    // Create the session constant.
    const session = await stripeTestStub.createSession({
      // Provide the pricing field value.
      pricing: { totalPrice: 50 },
      // Provide the reservation id field value.
      reservationId: 9,
    });

    // Assert that the value matches the intended expectation.
    expect(session.amount_total).toBe(12345);
    // Assert that the value matches the intended expectation.
    expect(session.currency).toBe('usd');

    // Call stripeTestStub.markPaid to perform this step.
    stripeTestStub.markPaid(session.id);
    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.retrieveSession(session.id).payment_status).toBe('paid');

    // Call stripeTestStub.expireSession to perform this step.
    stripeTestStub.expireSession(session.id);
    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.retrieveSession(session.id).status).toBe('expired');
  });

  // Define a single test case and its expectations.
  test('failNextCreateSession throws once', async () => {
    // Call stripeTestStub.failNextCreateSession to perform this step.
    stripeTestStub.failNextCreateSession();
    // Wait until the asynchronous operation resolves.
    await expect(
      // Call stripeTestStub.createSession to perform this step.
      stripeTestStub.createSession({ pricing: { totalPrice: 10 }, reservationId: 1 })
    // Continue the surrounding logic with this statement.
    ).rejects.toThrow(/forced create failure/i);

    // Create the session constant.
    const session = await stripeTestStub.createSession({
      // Provide the pricing field value.
      pricing: { totalPrice: 10 },
      // Provide the reservation id field value.
      reservationId: 1,
    });
    // Assert that the value matches the intended expectation.
    expect(session.id).toBeTruthy();
  });

  // Define a single test case and its expectations.
  test('createOrphanPaidSession has no reservation metadata', async () => {
    // Create the orphan constant.
    const orphan = await stripeTestStub.createOrphanPaidSession({ amountTotal: 2500 });
    // Assert that the value matches the intended expectation.
    expect(orphan.payment_status).toBe('paid');
    // Assert that the value matches the intended expectation.
    expect(orphan.metadata.reservationId).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(orphan.client_reference_id).toBeNull();
  });

  // Define a single test case and its expectations.
  test('replays createSession for the same idempotency key', async () => {
    // Create the first constant.
    const first = await stripeTestStub.createSession({
      // Provide the pricing field value.
      pricing: { totalPrice: 40 },
      // Provide the reservation id field value.
      reservationId: 8,
      // Provide the idempotency key field value.
      idempotencyKey: 'checkout:reservation:8:attempt1',
    });
    // Create the replay constant.
    const replay = await stripeTestStub.createSession({
      // Provide the pricing field value.
      pricing: { totalPrice: 99 },
      // Provide the reservation id field value.
      reservationId: 8,
      // Provide the idempotency key field value.
      idempotencyKey: 'checkout:reservation:8:attempt1',
    });

    // Assert that the value matches the intended expectation.
    expect(replay.id).toBe(first.id);
    // Assert that the value matches the intended expectation.
    expect(replay.amount_total).toBe(4000);
    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.sessions.size).toBe(1);
  });

  // Define a single test case and its expectations.
  test('supports refund create / retrieve / fail / pending', async () => {
    // Create the session constant.
    const session = await stripeTestStub.createSession({
      // Provide the pricing field value.
      pricing: { totalPrice: 80 },
      // Provide the reservation id field value.
      reservationId: 3,
    });

    // Call stripeTestStub.setNextRefundStatus to perform this step.
    stripeTestStub.setNextRefundStatus('pending');
    // Create the pending constant.
    const pending = stripeTestStub.createRefund({
      // Provide the payment intent id field value.
      paymentIntentId: session.payment_intent,
      // Provide the idempotency key field value.
      idempotencyKey: 'k-pending',
    });
    // Assert that the value matches the intended expectation.
    expect(pending.status).toBe('pending');

    // Call stripeTestStub.setRefundState to perform this step.
    stripeTestStub.setRefundState(pending.id, { status: 'succeeded' });
    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.retrieveRefund(pending.id).status).toBe('succeeded');

    // Call stripeTestStub.failNextCreateRefund to perform this step.
    stripeTestStub.failNextCreateRefund();
    // Assert that the value matches the intended expectation.
    expect(() =>
      // Call stripeTestStub.createRefund to perform this step.
      stripeTestStub.createRefund({
        // Provide the payment intent id field value.
        paymentIntentId: session.payment_intent,
        // Provide the idempotency key field value.
        idempotencyKey: 'k-fail',
      })
    // Continue the surrounding logic with this statement.
    ).toThrow(/forced refund failure/i);
  });
});
