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
  getReservationById,
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

describeIf('MONEY-003: staleSupersededStripeSession', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Stale Session Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  test('paid webhook for superseded Stripe session marks manual_review', async () => {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, { email: 'stale-session@example.com' });

    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const firstCheckout = await postCheckout(agent, checkoutBody);
    expect(firstCheckout.status).toBe(200);
    const staleSessionId = extractStripeSessionId(firstCheckout);

    const secondCheckout = await postCheckout(agent, checkoutBody);
    expect(secondCheckout.status).toBe(200);
    const activeSessionId = extractStripeSessionId(secondCheckout);
    expect(activeSessionId).not.toBe(staleSessionId);

    const reservation = await getReservationByStripeSessionId(activeSessionId);
    expect(reservation.status).toBe('processing_payment');
    expect(reservation.stripe_session_id).toBe(activeSessionId);

    stripeTestStub.markPaid(staleSessionId);

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_stale_superseded_${Date.now()}`,
      sessionId: staleSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const response = await postSignedWebhook(app, event);
    expect(response.status).toBe(200);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('manual_review');
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    expect(await countOrdersForCar(carId)).toBe(0);
  });
});
