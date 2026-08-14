const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  postOrder,
  postCheckout,
} = require('../helpers/sessionAgentFactory');
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
} = require('../../../src/services/reservationService');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('MONEY-009: processingCleanupMatrix', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Processing Cleanup Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  async function checkoutToExpiredHold() {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, {
      email: `cleanup-${Date.now()}@example.com`,
    });
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);

    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    await setHoldExpired(reservation.id);
    return { stripeSessionId, reservation };
  }

  test('open unpaid Stripe session keeps processing after cleanup', async () => {
    const { stripeSessionId, reservation } = await checkoutToExpiredHold();
    stripeTestStub.markUnpaidOpen(stripeSessionId);

    const result = await reconcileProcessingStripeReservations(new Date());
    expect(result.kept).toBeGreaterThanOrEqual(1);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('processing_payment');
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
  });

  test('paid Stripe session finalizes during cleanup', async () => {
    const { stripeSessionId, reservation } = await checkoutToExpiredHold();
    stripeTestStub.markPaid(stripeSessionId, {
      amount_total: Math.round(Number(reservation.total_price) * 100),
      currency: 'eur',
    });

    const result = await reconcileProcessingStripeReservations(new Date());
    expect(result.finalized).toBeGreaterThanOrEqual(1);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('confirmed');
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    expect(await countOrdersForCar(carId)).toBe(1);
  });

  test('expired unpaid Stripe session marks reservation expired', async () => {
    const { stripeSessionId, reservation } = await checkoutToExpiredHold();
    stripeTestStub.expireSession(stripeSessionId);

    const result = await reconcileProcessingStripeReservations(new Date());
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('expired');
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
  });
});
