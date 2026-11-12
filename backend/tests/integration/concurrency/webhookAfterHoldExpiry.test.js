const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const { createSessionAgent, postOrder, postCheckout } = require('../helpers/sessionAgentFactory');
const {
  buildCheckoutCompletedEvent,
  postSignedWebhook,
} = require('../helpers/stripeWebhookFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  buildCheckoutBody,
  getReservationByStripeSessionId,
  getOrderByReservationId,
  setHoldExpired,
  insertDateBlock,
  countOrdersForCar,
} = require('../helpers/dbFixtures');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Concurrency integration: webhookAfterHoldExpiry', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Hold Expiry Webhook Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  async function checkoutToProcessing(agent) {
    const checkoutBody = buildCheckoutBody(carId);
    const orderRes = await postOrder(agent, checkoutBody);
    expect(orderRes.status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);

    const stripeSessionId = checkoutRes.body.data.checkoutUrl
      .split('session_id=')
      .pop()
      ?.split('&')[0];

    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    return { stripeSessionId, reservation };
  }

  test('4a: expired hold with clear availability still finalizes paid webhook', async () => {
    const agent = await createSessionAgent(app);
    const { stripeSessionId, reservation } = await checkoutToProcessing(agent);

    await setHoldExpired(reservation.id);

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_hold_expired_clear',
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const response = await postSignedWebhook(app, event);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });

    const updated = await getReservationByStripeSessionId(stripeSessionId);
    expect(updated.status).toBe('confirmed');
    expect(await countOrdersForCar(carId)).toBe(1);
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
  });

  test('4b: expired hold with overlapping block marks manual_review', async () => {
    const agent = await createSessionAgent(app);
    const { stripeSessionId, reservation } = await checkoutToProcessing(agent);

    await setHoldExpired(reservation.id);
    await insertDateBlock(
      carId,
      new Date('2030-06-02T10:00:00.000Z'),
      new Date('2030-06-04T10:00:00.000Z')
    );

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_hold_expired_overlap',
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const response = await postSignedWebhook(app, event);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });

    const updated = await getReservationByStripeSessionId(stripeSessionId);
    expect(updated.status).toBe('manual_review');
    expect(await countOrdersForCar(carId)).toBe(0);
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
  });
});
