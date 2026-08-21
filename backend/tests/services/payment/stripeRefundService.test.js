const stripeTestStub = require('../../../src/services/payment/stripeTestStub');
const {
  createRefund,
  retrieveRefund,
} = require('../../../src/services/payment/stripeRefundService');

describe('stripeRefundService (stub)', () => {
  const prevStub = process.env.STRIPE_STUB;

  beforeEach(() => {
    process.env.STRIPE_STUB = '1';
    stripeTestStub.clearSessions();
  });

  afterAll(() => {
    process.env.STRIPE_STUB = prevStub;
    stripeTestStub.clearSessions();
  });

  test('creates and retrieves a succeeded refund', async () => {
    const session = stripeTestStub.createSession({
      reservationId: 1,
      pricing: { totalPrice: 120 },
    });

    const refund = await createRefund({
      paymentIntentId: session.payment_intent,
      idempotencyKey: 'refund:test:1',
    });

    expect(refund.status).toBe('succeeded');
    expect(refund.payment_intent).toBe(session.payment_intent);
    expect(refund.amount).toBe(12000);

    const again = await createRefund({
      paymentIntentId: session.payment_intent,
      idempotencyKey: 'refund:test:1',
    });
    expect(again.id).toBe(refund.id);

    const retrieved = await retrieveRefund(refund.id);
    expect(retrieved.id).toBe(refund.id);
  });

  test('failNextCreateRefund throws once', async () => {
    stripeTestStub.failNextCreateRefund();
    await expect(
      createRefund({
        paymentIntentId: 'pi_fail',
        idempotencyKey: 'refund:fail:1',
      })
    ).rejects.toThrow(/forced refund failure/);

    const refund = await createRefund({
      paymentIntentId: 'pi_fail',
      idempotencyKey: 'refund:fail:2',
    });
    expect(refund.status).toBe('succeeded');
  });

  test('setNextRefundStatus pending', async () => {
    stripeTestStub.setNextRefundStatus('pending');
    const refund = await createRefund({
      paymentIntentId: 'pi_pending',
      idempotencyKey: 'refund:pending:1',
    });
    expect(refund.status).toBe('pending');
  });
});
