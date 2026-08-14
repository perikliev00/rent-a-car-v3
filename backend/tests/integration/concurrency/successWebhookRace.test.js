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
  countOrdersForCar,
  countProcessedStripeEvents,
} = require('../helpers/dbFixtures');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Concurrency integration: successWebhookRace', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Success Webhook Race Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  async function startCheckout() {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId);

    const orderRes = await postOrder(agent, checkoutBody);
    expect(orderRes.status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);

    const stripeSessionId = checkoutRes.body.data.checkoutUrl
      .split('session_id=')
      .pop()
      ?.split('&')[0];
    expect(stripeSessionId).toMatch(/^cs_test_/);

    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation).toBeTruthy();
    expect(reservation.status).toBe('processing_payment');

    // H-06 stub keeps sessions unpaid until explicitly marked paid.
    stripeTestStub.markPaid(stripeSessionId, {
      amount_total: Math.round(Number(reservation.total_price) * 100),
      currency: 'eur',
    });

    return { agent, stripeSessionId, reservation };
  }

  test('parallel success page and webhook finalize exactly once', async () => {
    const { agent, stripeSessionId, reservation } = await startCheckout();

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_success_race_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const [successRes, webhookRes] = await Promise.all([
      agent.get(`/api/checkout/success?session_id=${stripeSessionId}`),
      postSignedWebhook(app, event),
    ]);

    // Either entry point may win the race; HTTP can briefly fail for the loser,
    // but the booking must end confirmed exactly once.
    const successConfirmed =
      successRes.status === 200 && successRes.body?.data?.confirmed === true;
    const webhookAccepted = webhookRes.status === 200;
    expect(successConfirmed || webhookAccepted).toBe(true);

    const updated = await getReservationByStripeSessionId(stripeSessionId);
    expect(updated.status).toBe('confirmed');
    expect(await countOrdersForCar(carId)).toBe(1);
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    expect(await countProcessedStripeEvents(event.id)).toBe(1);

    const successAfter = await agent.get(
      `/api/checkout/success?session_id=${stripeSessionId}`
    );
    expect(successAfter.status).toBe(200);
    expect(successAfter.body.data.confirmed).toBe(true);
  });

  test('webhook before success remains idempotent on success page', async () => {
    const { agent, stripeSessionId, reservation } = await startCheckout();

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_webhook_first_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const webhookRes = await postSignedWebhook(app, event);
    expect(webhookRes.status).toBe(200);

    const successRes = await agent.get(`/api/checkout/success?session_id=${stripeSessionId}`);
    expect(successRes.status).toBe(200);
    expect(successRes.body.data.confirmed).toBe(true);
    expect(successRes.body.data.title).toBe('Booking Confirmed');

    expect(await countOrdersForCar(carId)).toBe(1);
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
  });

  test('success before webhook finalizes, then webhook is idempotent', async () => {
    const { agent, stripeSessionId, reservation } = await startCheckout();

    const successRes = await agent.get(`/api/checkout/success?session_id=${stripeSessionId}`);
    expect(successRes.status).toBe(200);
    expect(successRes.body.data.confirmed).toBe(true);

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_success_first_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const webhookRes = await postSignedWebhook(app, event);
    expect(webhookRes.status).toBe(200);
    expect(webhookRes.body).toEqual({ received: true });

    expect(await countOrdersForCar(carId)).toBe(1);
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    expect((await getReservationByStripeSessionId(stripeSessionId)).status).toBe('confirmed');
  });
});
