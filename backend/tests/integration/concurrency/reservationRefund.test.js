const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  loginAsAdmin,
  postOrder,
  postCheckout,
  postAdminReservationRefund,
  postAdminReservationStatus,
} = require('../helpers/sessionAgentFactory');
const {
  buildCheckoutCompletedEvent,
  buildStripeEvent,
  postSignedWebhook,
} = require('../helpers/stripeWebhookFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  cleanupTestCar,
  buildCheckoutBody,
  getReservationByStripeSessionId,
  getReservationById,
  getOrderByReservationId,
  getDateBlocksForCar,
  getRefundOperationByReservationId,
  countOrdersForCar,
  getStatusHistory,
} = require('../helpers/dbFixtures');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('MONEY-REFUND: reservation refund via Stripe', () => {
  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Refund Flow Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  async function checkoutAndConfirm() {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, { email: 'refund-flow@example.com' });
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);

    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    const amountTotal = Math.round(Number(reservation.total_price) * 100);

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_refund_pay_${reservation.id}_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal,
      paymentIntent: stripeTestStub.sessions.get(stripeSessionId)?.payment_intent,
    });
    expect((await postSignedWebhook(app, event)).status).toBe(200);

    const confirmed = await getReservationById(reservation.id);
    expect(confirmed.status).toBe('confirmed');
    expect(confirmed.stripe_payment_intent_id).toBeTruthy();
    return confirmed;
  }

  test('admin refund succeeds: Stripe refund + domain side effects', async () => {
    const reservation = await checkoutAndConfirm();
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    expect(await countOrdersForCar(carId)).toBe(1);

    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'integration_refund',
    });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    expect(res.body.data.status).toBe('succeeded');

    const refunded = await getReservationById(reservation.id);
    expect(refunded.status).toBe('refunded');

    const op = await getRefundOperationByReservationId(reservation.id);
    expect(op.status).toBe('succeeded');
    expect(op.stripe_refund_id).toBeTruthy();
    expect(stripeTestStub.refunds.has(op.stripe_refund_id)).toBe(true);

    const order = await getOrderByReservationId(reservation.id);
    expect(order.is_deleted).toBe(true);
    expect(order.status).toBe('cancelled');
    expect(await countOrdersForCar(carId)).toBe(0);
    expect(await getDateBlocksForCar(carId)).toHaveLength(0);

    const history = await getStatusHistory(reservation.id);
    expect(history.some((h) => h.new_status === 'refunded')).toBe(true);

    const searchQs = new URLSearchParams({
      'pickup-date': '2030-06-01',
      'return-date': '2030-06-05',
      'pickup-time': '10:00',
      'return-time': '10:00',
      'pickup-location': 'office',
      'return-location': 'office',
    });
    const searchAgent = await createSessionAgent(app);
    const search = await searchAgent.get(`/api/cars/search?${searchQs.toString()}`);
    expect(search.status).toBe(200);
    const cars = search.body?.data?.cars ?? search.body?.cars ?? [];
    expect(cars.some((c) => Number(c.id) === carId)).toBe(true);
  });

  test('status-only refunded is rejected', async () => {
    const reservation = await checkoutAndConfirm();
    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationStatus(admin, reservation.id, {
      status: 'refunded',
      reason: 'should_fail',
    });
    expect(res.status).toBe(422);
    const still = await getReservationById(reservation.id);
    expect(still.status).toBe('confirmed');
  });

  test('parallel refunds are idempotent (one Stripe refund)', async () => {
    const reservation = await checkoutAndConfirm();
    const admin = await loginAsAdmin(app);

    const [a, b] = await Promise.all([
      postAdminReservationRefund(admin, reservation.id, { reason: 'parallel_a' }),
      postAdminReservationRefund(admin, reservation.id, { reason: 'parallel_b' }),
    ]);

    expect({
      a: { status: a.status, body: a.body },
      b: { status: b.status, body: b.body },
    }).toMatchObject({
      a: { status: 200 },
      b: { status: 200 },
    });
    expect([a.body.data.status, b.body.data.status].every((s) => s === 'succeeded')).toBe(true);

    expect(stripeTestStub.refunds.size).toBe(1);
    const op = await getRefundOperationByReservationId(reservation.id);
    expect(op.status).toBe('succeeded');
    expect((await getReservationById(reservation.id)).status).toBe('refunded');
  });

  test('pending refund then webhook applies domain', async () => {
    const reservation = await checkoutAndConfirm();
    stripeTestStub.setNextRefundStatus('pending');

    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'pending_then_webhook',
    });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    expect(res.body.data.status).toBe('pending');
    expect((await getReservationById(reservation.id)).status).toBe('confirmed');

    const op = await getRefundOperationByReservationId(reservation.id);
    expect(op.status).toBe('pending');
    stripeTestStub.setRefundState(op.stripe_refund_id, { status: 'succeeded' });

    const event = buildStripeEvent({
      eventId: `evt_refund_updated_${op.id}_${Date.now()}`,
      type: 'refund.updated',
      object: {
        id: op.stripe_refund_id,
        object: 'refund',
        status: 'succeeded',
        payment_intent: reservation.stripe_payment_intent_id,
        amount: op.amount_cents,
        currency: 'eur',
      },
    });
    expect((await postSignedWebhook(app, event)).status).toBe(200);

    expect((await getReservationById(reservation.id)).status).toBe('refunded');
    expect((await getRefundOperationByReservationId(reservation.id)).status).toBe('succeeded');
    expect(await getDateBlocksForCar(carId)).toHaveLength(0);
  });

  test('Stripe fail leaves reservation unchanged', async () => {
    const reservation = await checkoutAndConfirm();
    stripeTestStub.failNextCreateRefund();

    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'force_fail',
    });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 502 });

    expect((await getReservationById(reservation.id)).status).toBe('confirmed');
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    const op = await getRefundOperationByReservationId(reservation.id);
    expect(op.status).toBe('failed');
  });
});
