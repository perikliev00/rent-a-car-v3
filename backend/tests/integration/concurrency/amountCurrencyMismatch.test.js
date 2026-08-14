const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  postOrder,
  postCheckout,
} = require('../helpers/sessionAgentFactory');
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
  countOrdersForCar,
} = require('../helpers/dbFixtures');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('MONEY-004: amountCurrencyMismatch', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Amount Mismatch Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  async function checkoutToProcessing(agent) {
    const checkoutBody = buildCheckoutBody(carId, { email: 'mismatch@example.com' });
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    return { stripeSessionId, reservation };
  }

  test('amount mismatch marks manual_review without order', async () => {
    const agent = await createSessionAgent(app);
    const { stripeSessionId, reservation } = await checkoutToProcessing(agent);

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_amount_mismatch',
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100) + 500,
    });

    const response = await postSignedWebhook(app, event);
    expect(response.status).toBe(200);

    const updated = await getReservationByStripeSessionId(stripeSessionId);
    expect(updated.status).toBe('manual_review');
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    expect(await countOrdersForCar(carId)).toBe(0);
  });

  test('currency mismatch marks manual_review without order', async () => {
    const agent = await createSessionAgent(app);
    const { stripeSessionId, reservation } = await checkoutToProcessing(agent);

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_currency_mismatch',
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
      currency: 'usd',
    });

    const response = await postSignedWebhook(app, event);
    expect(response.status).toBe(200);

    const updated = await getReservationByStripeSessionId(stripeSessionId);
    expect(updated.status).toBe('manual_review');
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    expect(await countOrdersForCar(carId)).toBe(0);
  });
});
