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
  clearStripeSessionId,
  countOrdersForCar,
} = require('../helpers/dbFixtures');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('MONEY-013: orphanPaidSessionRecovery', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Orphan Recovery Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  test('paid webhook recovers when reservation has no linked stripe session id', async () => {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, { email: 'orphan-recovery@example.com' });

    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);

    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation.status).toBe('processing_payment');

    // Simulate link loss / orphan: paid Stripe session exists, reservation link cleared.
    await clearStripeSessionId(reservation.id);
    const unlinked = await getReservationById(reservation.id);
    expect(unlinked.stripe_session_id).toBeNull();

    stripeTestStub.markPaid(stripeSessionId, {
      amount_total: Math.round(Number(reservation.total_price) * 100),
      currency: 'eur',
    });

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_orphan_paid_recovery',
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const response = await postSignedWebhook(app, event);
    expect(response.status).toBe(200);

    const recovered = await getReservationById(reservation.id);
    expect(recovered.status).toBe('confirmed');
    expect(recovered.stripe_session_id).toBe(stripeSessionId);
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    expect(await countOrdersForCar(carId)).toBe(1);
  });
});
