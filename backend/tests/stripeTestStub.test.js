const stripeTestStub = require('../src/services/payment/stripeTestStub');

describe('stripeTestStub checkout idempotency', () => {
  beforeEach(() => {
    stripeTestStub.clearSessions();
  });

  afterEach(() => {
    stripeTestStub.clearSessions();
  });

  test('replays createSession for the same idempotency key', () => {
    const first = stripeTestStub.createSession({
      pricing: { totalPrice: 40 },
      reservationId: 8,
      idempotencyKey: 'checkout:reservation:8:attempt1',
    });
    const replay = stripeTestStub.createSession({
      pricing: { totalPrice: 99 },
      reservationId: 8,
      idempotencyKey: 'checkout:reservation:8:attempt1',
    });

    expect(replay.id).toBe(first.id);
    expect(replay.amount_total).toBe(4000);
    expect(stripeTestStub.sessions.size).toBe(1);
  });

  test('different idempotency keys create distinct sessions', () => {
    const first = stripeTestStub.createSession({
      pricing: { totalPrice: 40 },
      reservationId: 8,
      idempotencyKey: 'checkout:reservation:8:attempt1',
    });
    const second = stripeTestStub.createSession({
      pricing: { totalPrice: 40 },
      reservationId: 8,
      idempotencyKey: 'checkout:reservation:8:attempt2',
    });

    expect(second.id).not.toBe(first.id);
    expect(stripeTestStub.sessions.size).toBe(2);
  });
});
