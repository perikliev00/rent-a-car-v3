const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  postOrder,
  postCheckout,
} = require('../helpers/sessionAgentFactory');
const {
  buildCheckoutCompletedEvent,
  buildStripeEvent,
  postSignedWebhook,
  postUnsignedWebhook,
} = require('../helpers/stripeWebhookFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  buildCheckoutBody,
  getReservationByStripeSessionId,
  getReservationById,
  getOrderByReservationId,
  countOrdersForCar,
  countProcessedStripeEvents,
} = require('../helpers/dbFixtures');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('MONEY-011: invalidWebhookNoSideEffects', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Invalid Webhook Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  async function checkoutToProcessing() {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, { email: 'invalid-webhook@example.com' });
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    return { stripeSessionId, reservation };
  }

  test('invalid signature returns 400 and leaves reservation untouched', async () => {
    const { stripeSessionId, reservation } = await checkoutToProcessing();

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_invalid_sig',
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    const response = await postUnsignedWebhook(app, event);
    expect(response.status).toBe(400);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('processing_payment');
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    expect(await countProcessedStripeEvents('evt_invalid_sig')).toBe(0);
  });

  test('unpaid checkout.session.completed does not finalize', async () => {
    const { stripeSessionId, reservation } = await checkoutToProcessing();

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_unpaid_completed',
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
      paymentStatus: 'unpaid',
    });

    const response = await postSignedWebhook(app, event);
    expect(response.status).toBe(200);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('processing_payment');
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    expect(await countOrdersForCar(carId)).toBe(0);
  });

  test('unknown event type has no booking side effects', async () => {
    const { stripeSessionId, reservation } = await checkoutToProcessing();

    const event = buildStripeEvent({
      eventId: 'evt_unknown_type',
      type: 'payment_intent.succeeded',
      object: {
        id: 'pi_unknown',
        metadata: {
          reservationId: String(reservation.id),
          sessionId: reservation.session_id,
        },
      },
    });

    const response = await postSignedWebhook(app, event);
    expect(response.status).toBe(200);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('processing_payment');
    expect(updated.stripe_session_id).toBe(stripeSessionId);
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    expect(await countProcessedStripeEvents('evt_unknown_type')).toBe(0);
  });
});
