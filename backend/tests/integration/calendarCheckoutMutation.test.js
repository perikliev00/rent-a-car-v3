/**
 * B2: calendar move/resize during an active Stripe Checkout must not mutate
 * the offer; the original session must still finalize to a normal order.
 */
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const {
  createSessionAgent,
  loginAsAdmin,
  postOrder,
  postCheckout,
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
  getDateBlocksForCar,
  countOrdersForCar,
} = require('./helpers/dbFixtures');
const { parseSofiaDate, addSofiaCalendarDays, formatSofiaIsoDateFromParts } = require('../../src/utils/date/timezone');
const stripeTestStub = require('../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

async function patchCalendar(admin, mode, reservationId, body) {
  return withCsrf(
    admin,
    admin.patch(`/api/admin/calendar/events/reservation:${reservationId}/${mode}`)
  ).send(body);
}

describeIf('B2: calendarCheckoutMutation', () => {
  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'B2 Checkout Mutate Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  async function startCheckout() {
    const agent = await createSessionAgent(app);
    const body = buildCheckoutBody(carId, {
      email: `b2-checkout-${Date.now()}@example.com`,
      pickupDate: '2031-08-01',
      returnDate: '2031-08-04',
    });
    expect((await postOrder(agent, body)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, body);
    expect(checkoutRes.status).toBe(200);
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation.status).toBe('processing_payment');
    return { reservation, stripeSessionId, body };
  }

  test.each(['resize', 'move'])(
    '%s during processing_payment is rejected and paid webhook still confirms',
    async (mode) => {
      const { reservation, stripeSessionId } = await startCheckout();
      const totalBefore = Number(reservation.total_price);
      const pickupBefore = new Date(reservation.pickup_date).toISOString();
      const returnBefore = new Date(reservation.return_date).toISOString();

      const longerReturn = formatSofiaIsoDateFromParts(
        addSofiaCalendarDays(parseSofiaDate('2031-08-04', '00:00'), 2)
      );
      const admin = await loginAsAdmin(app);
      const mutate = await patchCalendar(admin, mode, reservation.id, {
        start: parseSofiaDate('2031-08-01', '10:00').toISOString(),
        end: parseSofiaDate(longerReturn, '10:00').toISOString(),
        carId,
      });
      expect(mutate.status).toBeGreaterThanOrEqual(400);

      const still = await getReservationById(reservation.id);
      expect(still.status).toBe('processing_payment');
      expect(Number(still.total_price)).toBe(totalBefore);
      expect(new Date(still.pickup_date).toISOString()).toBe(pickupBefore);
      expect(new Date(still.return_date).toISOString()).toBe(returnBefore);
      expect(still.stripe_session_id).toBe(stripeSessionId);

      const event = buildCheckoutCompletedEvent({
        eventId: `evt_b2_${mode}_${reservation.id}_${Date.now()}`,
        sessionId: stripeSessionId,
        reservationId: reservation.id,
        carId,
        sessionIdMeta: reservation.session_id,
        amountTotal: Math.round(totalBefore * 100),
        paymentIntent: stripeTestStub.sessions.get(stripeSessionId)?.payment_intent,
      });
      expect((await postSignedWebhook(app, event)).status).toBe(200);

      const confirmed = await getReservationById(reservation.id);
      expect(confirmed.status).toBe('confirmed');
      expect(Number(confirmed.total_price)).toBe(totalBefore);
      expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
      expect(await countOrdersForCar(carId)).toBe(1);
      expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    }
  );

  test('control: confirmed reservation without checkout can resize', async () => {
    const agent = await createSessionAgent(app);
    const body = buildCheckoutBody(carId, {
      email: `b2-control-${Date.now()}@example.com`,
      pickupDate: '2031-08-10',
      returnDate: '2031-08-13',
    });
    expect((await postOrder(agent, body)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, body);
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    const event = buildCheckoutCompletedEvent({
      eventId: `evt_b2_control_${reservation.id}_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
      paymentIntent: stripeTestStub.sessions.get(stripeSessionId)?.payment_intent,
    });
    expect((await postSignedWebhook(app, event)).status).toBe(200);

    const longerReturn = formatSofiaIsoDateFromParts(
      addSofiaCalendarDays(parseSofiaDate('2031-08-13', '00:00'), 2)
    );
    const admin = await loginAsAdmin(app);
    const resize = await patchCalendar(admin, 'resize', reservation.id, {
      start: parseSofiaDate('2031-08-10', '10:00').toISOString(),
      end: parseSofiaDate(longerReturn, '10:00').toISOString(),
      carId,
    });
    expect(resize.status).toBe(200);
    const updated = await getReservationById(reservation.id);
    expect(Number(updated.total_price)).toBeGreaterThan(Number(reservation.total_price));
  });

  test('control: duplicate paid webhook does not create a second order', async () => {
    const { reservation, stripeSessionId } = await startCheckout();
    const amountTotal = Math.round(Number(reservation.total_price) * 100);
    const buildEvent = (suffix) =>
      buildCheckoutCompletedEvent({
        eventId: `evt_b2_dup_${reservation.id}_${suffix}`,
        sessionId: stripeSessionId,
        reservationId: reservation.id,
        carId,
        sessionIdMeta: reservation.session_id,
        amountTotal,
        paymentIntent: stripeTestStub.sessions.get(stripeSessionId)?.payment_intent,
      });

    expect((await postSignedWebhook(app, buildEvent('a'))).status).toBe(200);
    expect((await postSignedWebhook(app, buildEvent('b'))).status).toBe(200);
    expect(await countOrdersForCar(carId)).toBe(1);
    expect((await getReservationById(reservation.id)).status).toBe('confirmed');
  });
});
