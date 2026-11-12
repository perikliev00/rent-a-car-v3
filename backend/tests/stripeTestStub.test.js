// Require the '../src/services/payment/stripeTestStub' module as stripeTestStub.
const stripeTestStub = require('../src/services/payment/stripeTestStub');

// Declare a test suite grouping related cases.
describe('stripeTestStub checkout idempotency', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
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
  test('different idempotency keys create distinct sessions', async () => {
    // Create the first constant.
    const first = await stripeTestStub.createSession({
      // Provide the pricing field value.
      pricing: { totalPrice: 40 },
      // Provide the reservation id field value.
      reservationId: 8,
      // Provide the idempotency key field value.
      idempotencyKey: 'checkout:reservation:8:attempt1',
    });
    // Create the second constant.
    const second = await stripeTestStub.createSession({
      // Provide the pricing field value.
      pricing: { totalPrice: 40 },
      // Provide the reservation id field value.
      reservationId: 8,
      // Provide the idempotency key field value.
      idempotencyKey: 'checkout:reservation:8:attempt2',
    });

    // Assert that the value matches the intended expectation.
    expect(second.id).not.toBe(first.id);
    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.sessions.size).toBe(2);
  });

  // Define a single test case and its expectations.
  test('create-session gate holds the first create until released', async () => {
    // Call stripeTestStub.armCreateSessionGate to perform this step.
    stripeTestStub.armCreateSessionGate();

    // Initialize the mutable created variable.
    let created = false;
    // Create the create promise constant.
    const createPromise = stripeTestStub
      // Call .createSession to perform this step.
      .createSession({
        // Provide the pricing field value.
        pricing: { totalPrice: 40 },
        // Provide the reservation id field value.
        reservationId: 8,
      })
      // Call .then to perform this step.
      .then((session) => {
        // Update created with the right-hand side value.
        created = true;
        // Return the resulting value to the caller.
        return session;
      });

    // Wait until the asynchronous operation resolves.
    await stripeTestStub.waitForCreateSession();
    // Assert that the value matches the intended expectation.
    expect(created).toBe(false);

    // Call stripeTestStub.releaseCreateSessionGate to perform this step.
    stripeTestStub.releaseCreateSessionGate();
    // Create the session constant.
    const session = await createPromise;
    // Assert that the value matches the intended expectation.
    expect(session.id).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(created).toBe(true);
  });

  // Define a single test case and its expectations.
  test('retrievePaymentIntent exposes remaining after a partial refund', async () => {
    // Create the session constant.
    const session = await stripeTestStub.createSession({
      // Provide the pricing field value.
      pricing: { totalPrice: 100 },
      // Provide the reservation id field value.
      reservationId: 9,
    });

    // Create the before constant.
    const before = stripeTestStub.retrievePaymentIntent(session.payment_intent, {
      // Provide the expand field value.
      expand: ['latest_charge'],
    });
    // Assert that the value matches the intended expectation.
    expect(before.amount_received).toBe(10000);
    // Assert that the value matches the intended expectation.
    expect(before.latest_charge.amount_refunded).toBe(0);

    // Call stripeTestStub.createRefund to perform this step.
    stripeTestStub.createRefund({
      // Provide the payment intent id field value.
      paymentIntentId: session.payment_intent,
      // Provide the amount cents field value.
      amountCents: 2500,
      // Provide the idempotency key field value.
      idempotencyKey: 'refund:partial:1',
    });

    // Create the after constant.
    const after = stripeTestStub.retrievePaymentIntent(session.payment_intent, {
      // Provide the expand field value.
      expand: ['latest_charge'],
    });
    // Assert that the value matches the intended expectation.
    expect(after.latest_charge.amount_refunded).toBe(2500);
    // Assert that the value matches the intended expectation.
    expect(after.amount_received - after.latest_charge.amount_refunded).toBe(7500);
  });
});
