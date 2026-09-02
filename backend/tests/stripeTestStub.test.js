const stripeTestStub = require('../src/services/payment/stripeTestStub');

describe('stripeTestStub checkout idempotency', () => {
  beforeEach(() => {
    stripeTestStub.clearSessions();
  });

  afterEach(() => {
    stripeTestStub.clearSessions();
  });

  test('replays createSession for the same idempotency key', async () => {
    const first = await stripeTestStub.createSession({
      pricing: { totalPrice: 40 },
      reservationId: 8,
      idempotencyKey: 'checkout:reservation:8:attempt1',
    });
    const replay = await stripeTestStub.createSession({
      pricing: { totalPrice: 99 },
      reservationId: 8,
      idempotencyKey: 'checkout:reservation:8:attempt1',
    });

    expect(replay.id).toBe(first.id);
    expect(replay.amount_total).toBe(4000);
    expect(stripeTestStub.sessions.size).toBe(1);
  });

  test('different idempotency keys create distinct sessions', async () => {
    const first = await stripeTestStub.createSession({
      pricing: { totalPrice: 40 },
      reservationId: 8,
      idempotencyKey: 'checkout:reservation:8:attempt1',
    });
    const second = await stripeTestStub.createSession({
      pricing: { totalPrice: 40 },
      reservationId: 8,
      idempotencyKey: 'checkout:reservation:8:attempt2',
    });

    expect(second.id).not.toBe(first.id);
    expect(stripeTestStub.sessions.size).toBe(2);
  });

  test('create-session gate holds the first create until released', async () => {
    stripeTestStub.armCreateSessionGate();

    let created = false;
    const createPromise = stripeTestStub
      .createSession({
        pricing: { totalPrice: 40 },
        reservationId: 8,
      })
      .then((session) => {
        created = true;
        return session;
      });

    await stripeTestStub.waitForCreateSession();
    expect(created).toBe(false);

    stripeTestStub.releaseCreateSessionGate();
    const session = await createPromise;
    expect(session.id).toBeTruthy();
    expect(created).toBe(true);
  });

  test('retrievePaymentIntent exposes remaining after a partial refund', async () => {
    const session = await stripeTestStub.createSession({
      pricing: { totalPrice: 100 },
      reservationId: 9,
    });

    const before = stripeTestStub.retrievePaymentIntent(session.payment_intent, {
      expand: ['latest_charge'],
    });
    expect(before.amount_received).toBe(10000);
    expect(before.latest_charge.amount_refunded).toBe(0);

    stripeTestStub.createRefund({
      paymentIntentId: session.payment_intent,
      amountCents: 2500,
      idempotencyKey: 'refund:partial:1',
    });

    const after = stripeTestStub.retrievePaymentIntent(session.payment_intent, {
      expand: ['latest_charge'],
    });
    expect(after.latest_charge.amount_refunded).toBe(2500);
    expect(after.amount_received - after.latest_charge.amount_refunded).toBe(7500);
  });
});
