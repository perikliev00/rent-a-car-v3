const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

describe('H-06: controllable Stripe stub', () => {
  beforeEach(() => {
    process.env.STRIPE_STUB = '1';
    stripeTestStub.clearSessions();
  });

  afterEach(() => {
    stripeTestStub.clearSessions();
  });

  test('creates open unpaid sessions by default', () => {
    const session = stripeTestStub.createSession({
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

  test('supports paid / expired / amount-currency overrides', () => {
    stripeTestStub.setNextCreateOverrides({
      paymentStatus: 'unpaid',
      status: 'open',
      amountTotal: 12345,
      currency: 'usd',
    });
    const session = stripeTestStub.createSession({
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

  test('failNextCreateSession throws once', () => {
    stripeTestStub.failNextCreateSession();
    expect(() =>
      stripeTestStub.createSession({ pricing: { totalPrice: 10 }, reservationId: 1 })
    ).toThrow(/forced create failure/i);

    const session = stripeTestStub.createSession({
      pricing: { totalPrice: 10 },
      reservationId: 1,
    });
    expect(session.id).toBeTruthy();
  });

  test('createOrphanPaidSession has no reservation metadata', () => {
    const orphan = stripeTestStub.createOrphanPaidSession({ amountTotal: 2500 });
    expect(orphan.payment_status).toBe('paid');
    expect(orphan.metadata.reservationId).toBeUndefined();
    expect(orphan.client_reference_id).toBeNull();
  });
});
