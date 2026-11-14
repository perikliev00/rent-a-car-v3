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
  getStatusHistory,
} = require('../helpers/dbFixtures');
const {
  reconcileProcessingStripeReservations,
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

  test('second reconcile of already-expired unpaid session is a no-op', async () => {
    const { stripeSessionId, reservation } = await checkoutToExpiredHold();
    stripeTestStub.expireSession(stripeSessionId);

    const first = await reconcileProcessingStripeReservations(new Date());
    expect(first.expired).toBeGreaterThanOrEqual(1);
    expect((await getReservationById(reservation.id)).status).toBe('expired');

    const { pool } = require('../../helpers/dbTestHarness');
    const historyBefore = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM reservation_status_history
      WHERE reservation_id = $1 AND old_status = 'expired' AND new_status = 'expired'
      `,
      [reservation.id]
    );

    const retrieveSpy = jest.spyOn(stripeTestStub, 'retrieveSession');
    await reconcileProcessingStripeReservations(new Date());
    const retrieveCallsForSession = retrieveSpy.mock.calls.filter(
      (args) => args[0] === stripeSessionId
    ).length;
    retrieveSpy.mockRestore();

    const historyAfter = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM reservation_status_history
      WHERE reservation_id = $1 AND old_status = 'expired' AND new_status = 'expired'
      `,
      [reservation.id]
    );

    expect(historyAfter.rows[0].count).toBe(historyBefore.rows[0].count);
    expect(retrieveCallsForSession).toBe(0);
    expect((await getReservationById(reservation.id)).status).toBe('expired');
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

  test('second cleanup cycle does not re-query Stripe or add expired→expired history', async () => {
    const { stripeSessionId, reservation } = await checkoutToExpiredHold();
    stripeTestStub.expireSession(stripeSessionId);

    const first = await reconcileProcessingStripeReservations(new Date());
    expect(first.expired).toBeGreaterThanOrEqual(1);
    expect((await getReservationById(reservation.id)).status).toBe('expired');
    const historyAfterFirst = await getStatusHistory(reservation.id);
    const expiredRows = (rows) => rows.filter((h) => h.new_status === 'expired');
    expect(expiredRows(historyAfterFirst)).toHaveLength(1);

    const retrieveSpy = jest.spyOn(stripeTestStub, 'retrieveSession');
    try {
      const second = await reconcileProcessingStripeReservations(new Date());
      expect(second.expired).toBe(0);

      const retrievedIds = retrieveSpy.mock.calls.map((args) => args[0]);
      expect(retrievedIds).not.toContain(stripeSessionId);
    } finally {
      retrieveSpy.mockRestore();
    }

    const historyAfterSecond = await getStatusHistory(reservation.id);
    expect(historyAfterSecond.length).toBe(historyAfterFirst.length);
    expect(expiredRows(historyAfterSecond)).toHaveLength(1);
    expect(historyAfterSecond.some((h) => h.old_status === 'expired' && h.new_status === 'expired')).toBe(
      false
    );
  });

  test('admin reconcileStripeSessions skips terminal stripe_session_expired rows', async () => {
    const { stripeSessionId, reservation } = await checkoutToExpiredHold();
    stripeTestStub.expireSession(stripeSessionId);

    expect((await reconcileProcessingStripeReservations(new Date())).expired).toBeGreaterThanOrEqual(1);
    expect((await getReservationById(reservation.id)).status).toBe('expired');

    const retrieveSpy = jest.spyOn(stripeTestStub, 'retrieveSession');
    try {
      const adminPass = await reconcileStripeSessions({ dryRun: false, limit: 200 });
      const touched = adminPass.results.some(
        (row) => String(row.reservationId) === String(reservation.id)
      );
      expect(touched).toBe(false);
      expect(retrieveSpy.mock.calls.map((args) => args[0])).not.toContain(stripeSessionId);
    } finally {
      retrieveSpy.mockRestore();
    }
  });
});
