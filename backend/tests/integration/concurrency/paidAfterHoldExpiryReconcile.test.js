/**
 * H2: a paid Stripe attempt must remain discoverable for reconcile after the
 * hold TTL expires — even when another guest creates a hold for the same car.
 */
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  createTwoSessionAgents,
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
  setHoldExpired,
  countOrdersForCar,
} = require('../helpers/dbFixtures');
const {
  reconcileProcessingStripeReservations,
  cleanUpAbandonedReservations,
} = require('../../../src/services/reservationService');
const {
  reconcileStripeSessions,
} = require('../../../src/services/payment/reconcileStripeSessionsService');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('H2: paid checkout survives hold expiry reconcile', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Paid Expiry Reconcile Car', price: 50 });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  async function checkoutProcessing(agent, overrides = {}) {
    const body = buildCheckoutBody(carId, overrides);
    expect((await postOrder(agent, body)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, body);
    expect(checkoutRes.status).toBe(200);
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    return { stripeSessionId, reservation, body };
  }

  test('worker cleanup finalizes paid A after hold expiry when B holds other dates', async () => {
    const [agentA, agentB] = await createTwoSessionAgents(app);
    const attemptA = await checkoutProcessing(agentA, {
      email: `paid-expiry-a-${Date.now()}@example.com`,
      pickupDate: '2032-05-01',
      returnDate: '2032-05-04',
    });

    stripeTestStub.markPaid(attemptA.stripeSessionId, {
      amount_total: Math.round(Number(attemptA.reservation.total_price) * 100),
      currency: 'eur',
    });
    await setHoldExpired(attemptA.reservation.id);

    // Guest B takes a non-overlapping hold; this path runs expireStaleHoldsForCar.
    const attemptB = await checkoutProcessing(agentB, {
      email: `paid-expiry-b-${Date.now()}@example.com`,
      pickupDate: '2032-06-01',
      returnDate: '2032-06-04',
    });
    expect(attemptB.reservation.status).toBe('processing_payment');

    await cleanUpAbandonedReservations();

    const afterA = await getReservationById(attemptA.reservation.id);
    expect(afterA.status).toBe('confirmed');
    expect(await getOrderByReservationId(attemptA.reservation.id)).toBeTruthy();
    expect(Number(afterA.paid_amount_cents)).toBe(
      Math.round(Number(attemptA.reservation.total_price) * 100)
    );
    expect(await countOrdersForCar(carId)).toBe(1);

    // Unpaid control: B remains processing (open unpaid session).
    const afterB = await getReservationById(attemptB.reservation.id);
    expect(afterB.status).toBe('processing_payment');
  });

  test('manual reconcileStripeSessions finalizes equivalent paid expired-hold attempt', async () => {
    const agent = await createSessionAgent(app);
    const attempt = await checkoutProcessing(agent, {
      email: `paid-manual-reconcile-${Date.now()}@example.com`,
      pickupDate: '2032-07-01',
      returnDate: '2032-07-03',
    });

    stripeTestStub.markPaid(attempt.stripeSessionId, {
      amount_total: Math.round(Number(attempt.reservation.total_price) * 100),
      currency: 'eur',
    });
    await setHoldExpired(attempt.reservation.id);

    // Simulate another guest creating a hold on the same car (other dates).
    const other = await createSessionAgent(app);
    await checkoutProcessing(other, {
      email: `paid-manual-other-${Date.now()}@example.com`,
      pickupDate: '2032-08-01',
      returnDate: '2032-08-03',
    });

    const dry = await reconcileStripeSessions({ dryRun: true, limit: 50 });
    expect(dry.dryRun).toBe(true);
    expect(dry.finalizedOrReady).toBeGreaterThanOrEqual(1);

    const live = await reconcileStripeSessions({ dryRun: false, limit: 50 });
    expect(live.finalizedOrReady).toBeGreaterThanOrEqual(1);

    const after = await getReservationById(attempt.reservation.id);
    expect(after.status).toBe('confirmed');
    expect(await getOrderByReservationId(attempt.reservation.id)).toBeTruthy();

    // Idempotent re-run + late webhook.
    const again = await reconcileStripeSessions({ dryRun: false, limit: 50 });
    expect(again).toBeTruthy();

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_late_after_reconcile_${Date.now()}`,
      sessionId: attempt.stripeSessionId,
      reservationId: attempt.reservation.id,
      carId,
      sessionIdMeta: attempt.reservation.session_id,
      amountTotal: Math.round(Number(attempt.reservation.total_price) * 100),
    });
    const webhookRes = await postSignedWebhook(app, event);
    expect(webhookRes.status).toBe(200);
    expect(await countOrdersForCar(carId)).toBe(1);
  });

  test('negative control: unpaid expired Stripe session is not finalized', async () => {
    const agent = await createSessionAgent(app);
    const attempt = await checkoutProcessing(agent, {
      email: `unpaid-expiry-control-${Date.now()}@example.com`,
      pickupDate: '2032-09-01',
      returnDate: '2032-09-03',
    });
    await setHoldExpired(attempt.reservation.id);
    stripeTestStub.expireSession(attempt.stripeSessionId);

    const result = await reconcileProcessingStripeReservations(new Date());
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const after = await getReservationById(attempt.reservation.id);
    expect(after.status).toBe('expired');
    expect(await getOrderByReservationId(attempt.reservation.id)).toBeNull();
  });
});
