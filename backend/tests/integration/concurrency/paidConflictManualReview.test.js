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
  insertTestAdmin,
  cleanupTestCar,
  buildCheckoutBody,
  getReservationByStripeSessionId,
  getOrderByReservationId,
  getDateBlocksForCar,
  countOrdersForCar,
  countProcessedStripeEvents,
  insertDateBlock,
} = require('../helpers/dbFixtures');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Concurrency integration: paidConflictManualReview', () => {
  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Paid Conflict Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('paid webhook after admin blocks dates marks manual_review', async () => {
    const userAgent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, { email: 'paid-conflict@example.com' });

    const orderRes = await postOrder(userAgent, checkoutBody);
    expect(orderRes.status).toBe(200);
    const checkoutRes = await postCheckout(userAgent, checkoutBody);
    expect(checkoutRes.status).toBe(200);

    const stripeSessionId = checkoutRes.body.data.checkoutUrl
      .split('session_id=')
      .pop()
      ?.split('&')[0];

    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    expect(reservation.status).toBe('processing_payment');

    await insertDateBlock(
      carId,
      new Date('2030-06-01T10:00:00.000Z'),
      new Date('2030-06-05T10:00:00.000Z')
    );

    const blocksBeforeWebhook = await getDateBlocksForCar(carId);
    expect(blocksBeforeWebhook).toHaveLength(1);

    const event = buildCheckoutCompletedEvent({
      eventId: 'evt_paid_conflict_manual_review',
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
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    expect(await countProcessedStripeEvents('evt_paid_conflict_manual_review')).toBe(1);

    const conflictOrder = await getDateBlocksForCar(carId);
    expect(conflictOrder[0].start_date).toBeTruthy();
  });
});
