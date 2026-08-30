const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

describe('H-06: controllable Stripe stub', () => {
  beforeEach(() => {
    process.env.STRIPE_STUB = '1';
    stripeTestStub.clearSessions();
  });

  afterEach(() => {
    stripeTestStub.clearSessions();
  });

  test('creates open unpaid sessions by default', async () => {
    const session = await stripeTestStub.createSession({
      reservationId: 1,
      carId: 2,
      sessionId: 'sess',
      pricing: { totalPrice: 100 },
    });

    expect(session.payment_status).toBe('unpaid');
    expect(session.status).toBe('open');
    expect(session.amount_total).toBe(10000);
    expect(session.currency).toBe('eur');
    expect(stripeTestStub.retrieveSession(session.id).payment_status).toBe('unpaid');
  });

  test('supports paid / expired / amount-currency overrides', async () => {
    stripeTestStub.setNextCreateOverrides({
      paymentStatus: 'unpaid',
      status: 'open',
      amountTotal: 12345,
      currency: 'usd',
    });
    const session = await stripeTestStub.createSession({
      pricing: { totalPrice: 50 },
      reservationId: 9,
    });

    expect(session.amount_total).toBe(12345);
    expect(session.currency).toBe('usd');

    stripeTestStub.markPaid(session.id);
    expect(stripeTestStub.retrieveSession(session.id).payment_status).toBe('paid');

    stripeTestStub.expireSession(session.id);
    expect(stripeTestStub.retrieveSession(session.id).status).toBe('expired');
  });

  test('failNextCreateSession throws once', async () => {
    stripeTestStub.failNextCreateSession();
    await expect(
      stripeTestStub.createSession({ pricing: { totalPrice: 10 }, reservationId: 1 })
    ).rejects.toThrow(/forced create failure/i);

    const session = await stripeTestStub.createSession({
      pricing: { totalPrice: 10 },
      reservationId: 1,
    });
    expect(session.id).toBeTruthy();
  });

  test('createOrphanPaidSession has no reservation metadata', async () => {
    const orphan = await stripeTestStub.createOrphanPaidSession({ amountTotal: 2500 });
    expect(orphan.payment_status).toBe('paid');
    expect(orphan.metadata.reservationId).toBeUndefined();
    expect(orphan.client_reference_id).toBeNull();
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

  test('supports refund create / retrieve / fail / pending', async () => {
    const session = await stripeTestStub.createSession({
      pricing: { totalPrice: 80 },
      reservationId: 3,
    });

    stripeTestStub.setNextRefundStatus('pending');
    const pending = stripeTestStub.createRefund({
      paymentIntentId: session.payment_intent,
      idempotencyKey: 'k-pending',
    });
    expect(pending.status).toBe('pending');

    stripeTestStub.setRefundState(pending.id, { status: 'succeeded' });
    expect(stripeTestStub.retrieveRefund(pending.id).status).toBe('succeeded');

    stripeTestStub.failNextCreateRefund();
    expect(() =>
      stripeTestStub.createRefund({
        paymentIntentId: session.payment_intent,
        idempotencyKey: 'k-fail',
      })
    ).toThrow(/forced refund failure/i);
  });
});
