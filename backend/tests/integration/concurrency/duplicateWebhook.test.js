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
  getDateBlocksForCar,
  countProcessedStripeEvents,
  countOrdersForCar,
} = require('../helpers/dbFixtures');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Concurrency integration: duplicateWebhook', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Duplicate Webhook Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('replays the same checkout.session.completed event idempotently', async () => {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId);

    const orderRes = await postOrder(agent, checkoutBody);
    expect(orderRes.status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);
    expect(checkoutRes.body.data.checkoutUrl).toBeTruthy();

    const stripeSessionId = checkoutRes.body.data.checkoutUrl
      .split('session_id=')
      .pop()
      ?.split('&')[0];
    expect(stripeSessionId).toMatch(/^cs_test_/);

    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation).toBeTruthy();
    expect(reservation.status).toBe('processing_payment');

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_duplicate_integration_1',
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const first = await postSignedWebhook(app, event);
    const second = await postSignedWebhook(app, event);

    expect(first.status).toBe(200);
    expect(first.body).toEqual({ received: true });
    expect(second.status).toBe(200);
    expect(second.body).toEqual({ received: true });

    const updatedReservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(updatedReservation.status).toBe('confirmed');

    expect(await countOrdersForCar(carId)).toBe(1);
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    expect(await countProcessedStripeEvents('evt_duplicate_integration_1')).toBe(1);
  });
});
