/**
 * P1: cars in HARD_UNBOOKABLE_STATUSES must not get new holds or checkout sessions.
 * Paid webhook after the fleet flips to in_maintenance must not confirm an order.
 */
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const {
  createSessionAgent,
  loginAsAdmin,
  postOrder,
  postCheckout,
  postReleaseAndRehold,
  withCsrf,
} = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  cleanupTestCar,
  buildOrderBody,
  buildCheckoutBody,
  countActiveReservationsForCar,
  countOrdersForCar,
  getReservationByStripeSessionId,
  getReservationById,
  getOrderByReservationId,
  getDateBlocksForCar,
} = require('./helpers/dbFixtures');
const {
  buildCheckoutCompletedEvent,
  postSignedWebhook,
} = require('./helpers/stripeWebhookFactory');
const { pool } = require('../helpers/dbTestHarness');
const stripeTestStub = require('../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

async function setCarStatus(carId, status) {
  await pool.query(`UPDATE cars SET status = $2, updated_at = NOW() WHERE id = $1`, [
    carId,
    status,
  ]);
}

describeIf('P1: fleetBookingAvailability', () => {
  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Fleet Availability Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  test('control: available car accepts hold and checkout', async () => {
    const agent = await createSessionAgent(app);
    const body = buildCheckoutBody(carId, { email: 'fleet-ok@example.com' });
    expect((await postOrder(agent, body)).status).toBe(200);
    const checkout = await postCheckout(agent, body);
    expect(checkout.status).toBe(200);
    expect(checkout.body.data.checkoutUrl).toMatch(/session_id=/);
  });

  test('in_maintenance blocks new hold and checkout', async () => {
    const admin = await loginAsAdmin(app);
    const statusRes = await withCsrf(admin, admin.post(`/api/admin/cars/${carId}/status`)).send({
      status: 'in_maintenance',
    });
    expect([200, 201].includes(statusRes.status) || statusRes.status === 200).toBe(true);
    if (statusRes.status >= 400) {
      await setCarStatus(carId, 'in_maintenance');
    }

    const agent = await createSessionAgent(app);
    const hold = await postOrder(agent, buildOrderBody(carId));
    expect(hold.status).toBeGreaterThanOrEqual(400);
    expect(await countActiveReservationsForCar(carId)).toBe(0);

    const checkout = await postCheckout(
      agent,
      buildCheckoutBody(carId, { email: 'fleet-maint@example.com' })
    );
    expect(checkout.status).toBeGreaterThanOrEqual(400);
    expect(stripeTestStub.sessions.size).toBe(0);
  });

  test('hold created before maintenance cannot checkout after status change', async () => {
    const agent = await createSessionAgent(app);
    const body = buildCheckoutBody(carId, { email: 'fleet-stale-hold@example.com' });
    expect((await postOrder(agent, body)).status).toBe(200);
    expect(await countActiveReservationsForCar(carId)).toBe(1);

    await setCarStatus(carId, 'in_maintenance');
    const sessionsBefore = stripeTestStub.sessions.size;
    const checkout = await postCheckout(agent, body);
    expect(checkout.status).toBeGreaterThanOrEqual(400);
    expect(stripeTestStub.sessions.size).toBe(sessionsBefore);
  });

  test.each(['damaged', 'inactive'])('%s blocks new holds', async (status) => {
    await setCarStatus(carId, status);
    const agent = await createSessionAgent(app);
    const hold = await postOrder(agent, buildOrderBody(carId));
    expect(hold.status).toBeGreaterThanOrEqual(400);
    expect(await countActiveReservationsForCar(carId)).toBe(0);
  });

  test('release-and-rehold onto in_maintenance car is refused', async () => {
    const otherCarId = await insertIsolatedTestCar({ name: 'Fleet Rehold Target' });
    try {
      const agent = await createSessionAgent(app);
      const body = buildOrderBody(carId);
      expect((await postOrder(agent, body)).status).toBe(200);

      await setCarStatus(otherCarId, 'in_maintenance');
      const sessionsBefore = stripeTestStub.sessions.size;
      const rehold = await postReleaseAndRehold(agent, {
        ...body,
        carId: otherCarId,
        pickupTime: '10:00',
        returnTime: '10:00',
      });
      expect(rehold.status).toBeGreaterThanOrEqual(400);
      expect(stripeTestStub.sessions.size).toBe(sessionsBefore);
      expect(await countActiveReservationsForCar(otherCarId)).toBe(0);
      expect(await countActiveReservationsForCar(carId)).toBe(1);
    } finally {
      await cleanupTestCar(otherCarId);
    }
  });

  test('control: paid webhook for available car creates exactly one confirmed order', async () => {
    const agent = await createSessionAgent(app);
    const body = buildCheckoutBody(carId, { email: 'fleet-pay-ok@example.com' });
    expect((await postOrder(agent, body)).status).toBe(200);
    const checkout = await postCheckout(agent, body);
    expect(checkout.status).toBe(200);

    const stripeSessionId = checkout.body.data.checkoutUrl
      .split('session_id=')
      .pop()
      ?.split('&')[0];
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    const amountTotal = Math.round(Number(reservation.total_price) * 100);
    const event = buildCheckoutCompletedEvent({
      eventId: `evt_fleet_pay_ok_${reservation.id}_${Date.now()}`,
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
    expect(Number(confirmed.paid_amount_cents)).toBe(amountTotal);
    expect(await countOrdersForCar(carId)).toBe(1);
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
  });

  test('paid webhook after car enters in_maintenance goes to manual_review without order', async () => {
    const agent = await createSessionAgent(app);
    const body = buildCheckoutBody(carId, { email: 'fleet-pay-maint@example.com' });
    expect((await postOrder(agent, body)).status).toBe(200);
    const checkout = await postCheckout(agent, body);
    expect(checkout.status).toBe(200);

    const stripeSessionId = checkout.body.data.checkoutUrl
      .split('session_id=')
      .pop()
      ?.split('&')[0];
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    const amountTotal = Math.round(Number(reservation.total_price) * 100);
    const paymentIntent =
      stripeTestStub.sessions.get(stripeSessionId)?.payment_intent ||
      `pi_fleet_maint_${reservation.id}`;

    const admin = await loginAsAdmin(app);
    const statusRes = await withCsrf(admin, admin.post(`/api/admin/cars/${carId}/status`)).send({
      status: 'in_maintenance',
    });
    if (statusRes.status >= 400) {
      await setCarStatus(carId, 'in_maintenance');
    } else {
      expect(statusRes.status).toBe(200);
    }

    const carRow = await pool.query('SELECT status FROM cars WHERE id = $1', [carId]);
    expect(carRow.rows[0].status).toBe('in_maintenance');
    expect(await getDateBlocksForCar(carId)).toHaveLength(0);

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_fleet_pay_maint_${reservation.id}_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal,
      paymentIntent,
    });
    expect((await postSignedWebhook(app, event)).status).toBe(200);

    const reviewed = await getReservationById(reservation.id);
    expect(reviewed.status).toBe('manual_review');
    expect(Number(reviewed.paid_amount_cents)).toBe(amountTotal);
    expect(reviewed.stripe_session_id).toBe(stripeSessionId);
    expect(reviewed.stripe_payment_intent_id).toBeTruthy();
    expect(await getOrderByReservationId(reservation.id)).toBeFalsy();
    expect(await countOrdersForCar(carId)).toBe(0);
    expect(await getDateBlocksForCar(carId)).toHaveLength(0);
  });
});
