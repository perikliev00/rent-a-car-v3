const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  postOrder,
  postCheckout,
  postRelease,
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

describeIf('MONEY-002: paidAfterCancel', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Paid After Cancel Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  test('paid webhook after cancel marks manual_review without creating order', async () => {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, { email: 'paid-after-cancel@example.com' });

    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);

    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation.status).toBe('processing_payment');

    const releaseRes = await postRelease(agent);
    expect(releaseRes.status).toBe(200);

    const cancelled = await getReservationById(reservation.id);
    expect(cancelled.status).toBe('cancelled');

    stripeTestStub.markPaid(stripeSessionId);

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_paid_after_cancel',
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const response = await postSignedWebhook(app, event);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ received: true });

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('manual_review');
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    expect(await countOrdersForCar(carId)).toBe(0);
  });
});
