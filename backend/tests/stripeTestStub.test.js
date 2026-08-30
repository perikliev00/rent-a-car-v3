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
});
