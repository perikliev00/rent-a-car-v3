/**
 * P1: cancelling a paid reservation must keep refund reachability
 * (queue visibility and/or refund_decision metadata + POST /refund).
 */
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const {
  createSessionAgent,
  loginAsAdmin,
  postOrder,
  postCheckout,
  postAdminReservationRefund,
  postAdminReservationStatus,
  withCsrf,
} = require('./helpers/sessionAgentFactory');
const {
  buildCheckoutCompletedEvent,
  postSignedWebhook,
} = require('./helpers/stripeWebhookFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  cleanupTestCar,
  buildCheckoutBody,
  getReservationByStripeSessionId,
  getReservationById,
  getOrderByReservationId,
  getRefundOperationByReservationId,
} = require('./helpers/dbFixtures');
const stripeTestStub = require('../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('P1: paidCancellation', () => {
  let app;
  let carId;
  let admin;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Paid Cancellation Car' });
    admin = await loginAsAdmin(app);
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  async function createPaidConfirmedReservation() {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, {
      email: `paid-cancel-${Date.now()}@example.com`,
    });
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    const event = buildCheckoutCompletedEvent({
      eventId: `evt_paid_cancel_${reservation.id}_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
      paymentIntent: stripeTestStub.sessions.get(stripeSessionId)?.payment_intent,
    });
    expect((await postSignedWebhook(app, event)).status).toBe(200);
    const confirmed = await getReservationById(reservation.id);
    expect(confirmed.status).toBe('confirmed');
    return confirmed;
  }

  test('after status cancel, paid booking stays refundable via admin refund API', async () => {
    const reservation = await createPaidConfirmedReservation();
    const cancelRes = await postAdminReservationStatus(admin, reservation.id, {
      status: 'cancelled',
      reason: 'paid_cancel_probe',
    });
    expect(cancelRes.status).toBe(200);
    expect((await getReservationById(reservation.id)).status).toBe('cancelled');

    const queue = await admin.get(`/api/admin/payments/refund-queue?q=${reservation.id}`);
    expect(queue.status).toBe(200);
    const refundableIds = (queue.body.data.refundable || []).map((row) => String(row.id));
    expect(refundableIds).toContain(String(reservation.id));

    const refundRes = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'refund_after_paid_cancel',
    });
    expect(refundRes.status).toBe(200);
    expect(refundRes.body.data.status).toBe('succeeded');
    expect((await getReservationById(reservation.id)).status).toBe('refunded');
    expect((await getRefundOperationByReservationId(reservation.id)).status).toBe('succeeded');
  });

  test('calendar cancel of paid booking remains refundable', async () => {
    const reservation = await createPaidConfirmedReservation();
    const cancelRes = await withCsrf(
      admin,
      admin.post(`/api/admin/calendar/reservations/${reservation.id}/cancel`)
    ).send({});
    expect(cancelRes.status).toBe(200);
    expect((await getReservationById(reservation.id)).status).toBe('cancelled');

    const refundRes = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'refund_after_calendar_cancel',
    });
    expect(refundRes.status).toBe(200);
    expect(refundRes.body.data.status).toBe('succeeded');
  });

  test('order delete of paid booking remains refundable', async () => {
    const reservation = await createPaidConfirmedReservation();
    const order = await getOrderByReservationId(reservation.id);
    const del = await withCsrf(admin, admin.delete(`/api/admin/orders/${order.id}`));
    expect(del.status).toBe(200);
    expect((await getReservationById(reservation.id)).status).toBe('cancelled');

    const refundRes = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'refund_after_order_delete',
    });
    expect(refundRes.status).toBe(200);
    expect(refundRes.body.data.status).toBe('succeeded');
  });

  test('unpaid hold cancels without becoming refundable', async () => {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, {
      email: `unpaid-cancel-${Date.now()}@example.com`,
    });
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);

    const cancelRes = await postAdminReservationStatus(admin, reservation.id, {
      status: 'cancelled',
      reason: 'unpaid_cancel_probe',
    });
    expect(cancelRes.status).toBe(200);
    expect((await getReservationById(reservation.id)).status).toBe('cancelled');

    const queue = await admin.get(`/api/admin/payments/refund-queue?q=${reservation.id}`);
    expect(queue.status).toBe(200);
    const refundableIds = (queue.body.data.refundable || []).map((row) => String(row.id));
    expect(refundableIds).not.toContain(String(reservation.id));

    const refundRes = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'should_not_refund_unpaid',
    });
    expect(refundRes.status).toBeGreaterThanOrEqual(400);
  });
});
