const { URLSearchParams } = require('node:url');
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
const { buildIdempotencyKey } = require('../../../src/services/payment/refund/refundPolicy');

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

  test('partial charge.refunded does not apply domain refund', async () => {
    const reservation = await checkoutAndConfirm();
    stripeTestStub.setNextRefundStatus('pending');

    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'partial_charge_refunded',
    });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    expect(res.body.data.status).toBe('pending');

    const op = await getRefundOperationByReservationId(reservation.id);
    expect(op.status).toBe('pending');
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);

    const event = buildStripeEvent({
      eventId: `evt_charge_refunded_partial_${op.id}_${Date.now()}`,
      type: 'charge.refunded',
      object: {
        id: 'ch_partial_1',
        object: 'charge',
        status: 'succeeded',
        refunded: false,
        amount: op.amount_cents,
        amount_refunded: Math.max(1, Math.floor(Number(op.amount_cents) / 4)),
        currency: 'eur',
        payment_intent: reservation.stripe_payment_intent_id,
      },
    });
    expect((await postSignedWebhook(app, event)).status).toBe(200);

    expect((await getReservationById(reservation.id)).status).toBe('confirmed');
    expect((await getRefundOperationByReservationId(reservation.id)).status).not.toBe('succeeded');
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
  });

  test('pending refund blocks pickup to picked_up', async () => {
    const reservation = await checkoutAndConfirm();
    const admin = await loginAsAdmin(app);

    const prepared = await postAdminReservationStatus(admin, reservation.id, {
      status: 'car_prepared',
      reason: 'ready_for_refund_race',
    });
    expect(prepared.status).toBe(200);
    expect((await getReservationById(reservation.id)).status).toBe('car_prepared');

    stripeTestStub.setNextRefundStatus('pending');
    const refundRes = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'refund_vs_pickup',
    });
    expect({ status: refundRes.status, body: refundRes.body }).toMatchObject({ status: 200 });
    expect(refundRes.body.data.status).toBe('pending');

    const pickup = await postAdminReservationStatus(admin, reservation.id, {
      status: 'picked_up',
      reason: 'should_block',
    });
    expect(pickup.status).toBe(409);
    expect(pickup.body.error.code).toBe('REFUND_IN_PROGRESS');
    expect((await getReservationById(reservation.id)).status).toBe('car_prepared');
    expect((await getRefundOperationByReservationId(reservation.id)).status).toBe('pending');
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
  });

  test('pending refund blocks admin cancel', async () => {
    const reservation = await checkoutAndConfirm();
    stripeTestStub.setNextRefundStatus('pending');

    const admin = await loginAsAdmin(app);
    const refundRes = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'refund_vs_cancel',
    });
    expect({ status: refundRes.status, body: refundRes.body }).toMatchObject({ status: 200 });
    expect(refundRes.body.data.status).toBe('pending');

    const cancel = await postAdminReservationStatus(admin, reservation.id, {
      status: 'cancelled',
      reason: 'should_block',
    });
    expect(cancel.status).toBe(409);
    expect(cancel.body.error.code).toBe('REFUND_IN_PROGRESS');
    expect((await getReservationById(reservation.id)).status).toBe('confirmed');
    expect((await getRefundOperationByReservationId(reservation.id)).status).toBe('pending');
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
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

  test('failed admin refund then retry uses attempt2, not :full', async () => {
    const reservation = await checkoutAndConfirm();
    stripeTestStub.failNextCreateRefund();

    const admin = await loginAsAdmin(app);
    const first = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'force_fail_then_retry',
    });
    expect({ status: first.status, body: first.body }).toMatchObject({ status: 502 });
    expect((await getReservationById(reservation.id)).status).toBe('confirmed');
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);

    const failedOp = await getRefundOperationByReservationId(reservation.id);
    expect(failedOp.status).toBe('failed');
    expect(failedOp.stripe_refund_id).toBeFalsy();
    expect(failedOp.idempotency_key).toBe(buildIdempotencyKey(reservation.id, 1));

    const second = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'retry_after_confirmed_fail',
    });
    expect({ status: second.status, body: second.body }).toMatchObject({ status: 200 });

    const latest = await getRefundOperationByReservationId(reservation.id);
    expect(latest.idempotency_key).toBe(buildIdempotencyKey(reservation.id, 2));
    expect(latest.idempotency_key).not.toBe(buildIdempotencyKey(reservation.id, 1));
    expect(latest.status).toBe('succeeded');
    expect(stripeTestStub.refunds.size).toBe(1);
    expect((await getReservationById(reservation.id)).status).toBe('refunded');
  });

  test('concurrent succeeded and failed HTTP webhooks never leave refunded+failed', async () => {
    const reservation = await checkoutAndConfirm();
    stripeTestStub.setNextRefundStatus('pending');

    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'concurrent_http_webhooks',
    });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    expect(res.body.data.status).toBe('pending');

    const op = await getRefundOperationByReservationId(reservation.id);
    expect(op.status).toBe('pending');
    expect(op.stripe_refund_id).toBeTruthy();

    const refundObject = {
      id: op.stripe_refund_id,
      object: 'refund',
      payment_intent: reservation.stripe_payment_intent_id,
      amount: op.amount_cents,
      currency: 'eur',
    };

    const [succeededRes, failedRes] = await Promise.all([
      postSignedWebhook(
        app,
        buildStripeEvent({
          eventId: `evt_refund_ok_${op.id}_${Date.now()}`,
          type: 'refund.updated',
          object: { ...refundObject, status: 'succeeded' },
        })
      ),
      postSignedWebhook(
        app,
        buildStripeEvent({
          eventId: `evt_refund_fail_${op.id}_${Date.now()}`,
          type: 'refund.failed',
          object: { ...refundObject, status: 'failed' },
        })
      ),
    ]);
    expect(succeededRes.status).toBe(200);
    expect(failedRes.status).toBe(200);

    const finalReservation = await getReservationById(reservation.id);
    const finalOp = await getRefundOperationByReservationId(reservation.id);
    expect(finalReservation.status === 'refunded' && finalOp.status === 'failed').toBe(false);
    expect(finalOp.status).toBe('succeeded');
    expect(finalReservation.status).toBe('refunded');
  });

  test('timeout after Stripe success leaves pending :full then retry applies', async () => {
    const reservation = await checkoutAndConfirm();
    stripeTestStub.throwNextCreateRefundAfterRecording();

    const admin = await loginAsAdmin(app);
    const first = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'timeout_after_record',
    });
    expect({ status: first.status, body: first.body }).toMatchObject({ status: 503 });
    expect(first.body.error.code).toBe('REFUND_INDETERMINATE');

    const pendingOp = await getRefundOperationByReservationId(reservation.id);
    expect(pendingOp.status).toBe('pending');
    expect(pendingOp.idempotency_key).toBe(buildIdempotencyKey(reservation.id, 1));
    expect(pendingOp.idempotency_key).not.toBe(buildIdempotencyKey(reservation.id, 2));

    const second = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'retry_after_timeout',
    });
    expect({ status: second.status, body: second.body }).toMatchObject({ status: 200 });

    const latest = await getRefundOperationByReservationId(reservation.id);
    expect(latest.idempotency_key).toBe(buildIdempotencyKey(reservation.id, 1));
    expect(latest.idempotency_key).not.toBe(buildIdempotencyKey(reservation.id, 2));
    expect(latest.status).toBe('succeeded');
    expect((await getReservationById(reservation.id)).status).toBe('refunded');
  });

  test('concurrent succeed apply and markFailed leave ledger succeeded', async () => {
    const reservation = await checkoutAndConfirm();
    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'race_succeed_vs_fail',
    });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('succeeded');

    const op = await getRefundOperationByReservationId(reservation.id);
    const { applySucceededRefund } = require('../../../src/services/payment/refund/applyRefundService');
    const { markRefundFailed } = require('../../../src/services/payment/refund/refundLedgerService');

    await Promise.all([
      applySucceededRefund({
        refundOperation: {
          id: op.id,
          reservationId: op.reservation_id,
          status: op.status,
          stripeRefundId: op.stripe_refund_id,
        },
        reservationId: reservation.id,
        stripeRefund: { id: op.stripe_refund_id, status: 'succeeded' },
        actor: { type: 'system' },
      }),
      markRefundFailed(
        { id: op.id, status: op.status },
        { code: 'failed', message: 'concurrent_fail' }
      ),
    ]);

    const finalOp = await getRefundOperationByReservationId(reservation.id);
    const finalReservation = await getReservationById(reservation.id);
    expect(finalReservation.status).toBe('refunded');
    expect(finalOp.status).toBe('succeeded');
    expect(finalOp.status).not.toBe('failed');
  });

  test('full refund after quote reprice refunds the original paid amount', async () => {
    const reservation = await checkoutAndConfirm();
    const paidCents = Math.round(Number(reservation.total_price) * 100);
    expect(paidCents).toBeGreaterThan(0);
    expect(Number(reservation.paid_amount_cents)).toBe(paidCents);

    const { pool } = require('../../helpers/dbTestHarness');
    const lowered = Number(reservation.total_price) / 2;
    await pool.query('UPDATE reservations SET total_price = $1 WHERE id = $2', [
      lowered,
      reservation.id,
    ]);
    await pool.query('UPDATE orders SET total_price = $1 WHERE reservation_id = $2', [
      lowered,
      reservation.id,
    ]);

    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'reprice_then_full_refund',
    });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    expect(res.body.data.status).toBe('succeeded');

    const op = await getRefundOperationByReservationId(reservation.id);
    expect(op.amount_cents).toBe(paidCents);
    expect(op.amount_cents).not.toBe(Math.round(lowered * 100));

    const stripeRefund = stripeTestStub.refunds.get(op.stripe_refund_id);
    expect(stripeRefund.amount).toBe(paidCents);

    const refunded = await getReservationById(reservation.id);
    expect(refunded.status).toBe('refunded');
    expect(Number(refunded.paid_amount_cents)).toBe(paidCents);

    const order = await getOrderByReservationId(reservation.id);
    expect(order.is_deleted).toBe(true);
    expect(order.status).toBe('cancelled');
  });
});
