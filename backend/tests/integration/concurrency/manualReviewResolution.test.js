const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  loginAsAdmin,
  postOrder,
  postCheckout,
  postAdminReservationStatus,
  postAdminReservationRefund,
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
  getReservationById,
  getOrderByReservationId,
  getDateBlocksForCar,
  countOrdersForCar,
  insertDateBlock,
} = require('../helpers/dbFixtures');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('MONEY-007: manualReviewResolution', () => {
  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Manual Review Resolve Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  async function forceManualReview() {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, { email: 'manual-review@example.com' });
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);

    const stripeSessionId = extractStripeSessionId(checkoutRes);
    const reservation = await getReservationByStripeSessionId(stripeSessionId);

    await insertDateBlock(
      carId,
      new Date('2030-06-01T10:00:00.000Z'),
      new Date('2030-06-05T10:00:00.000Z')
    );

    const event = buildCheckoutCompletedEvent({
      eventId: `evt_manual_review_${reservation.id}_${Date.now()}`,
      sessionId: stripeSessionId,
      reservationId: reservation.id,
      carId,
      sessionIdMeta: reservation.session_id,
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    expect((await postSignedWebhook(app, event)).status).toBe(200);

    const updated = await getReservationById(reservation.id);
    expect(updated.status).toBe('manual_review');
    return updated;
  }

  test('admin confirm from manual_review creates order and date block', async () => {
    const reservation = await forceManualReview();
    // Clear the conflict block so confirm can addRange for the booking window.
    await require('../../helpers/dbTestHarness').pool.query(
      'DELETE FROM car_date_blocks WHERE car_id = $1',
      [carId]
    );

    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationStatus(admin, reservation.id, {
      status: 'confirmed',
      reason: 'admin_manual_review_confirm',
    });
    expect(res.status).toBe(200);

    const confirmed = await getReservationById(reservation.id);
    expect(confirmed.status).toBe('confirmed');
    const order = await getOrderByReservationId(reservation.id);
    expect(order).toBeTruthy();
    expect(await countOrdersForCar(carId)).toBe(1);
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);

    const { pool } = require('../../helpers/dbTestHarness');
    const notes = await pool.query(
      `
      SELECT id, type, reservation_id, order_id, idempotency_key
      FROM notifications
      WHERE reservation_id = $1
        AND type = 'reservation_confirmation'
      ORDER BY id ASC
      `,
      [reservation.id]
    );
    expect(notes.rowCount).toBe(1);
    expect(notes.rows[0].idempotency_key).toBe(
      `reservation_confirmation:order:${order.id}`
    );

    // Repeat confirm is a no-op for notifications (already confirmed).
    const again = await postAdminReservationStatus(admin, reservation.id, {
      status: 'confirmed',
      reason: 'admin_manual_review_confirm_repeat',
    });
    expect([200, 422].includes(again.status)).toBe(true);
    const notesAfter = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE reservation_id = $1 AND type = 'reservation_confirmation'
      `,
      [reservation.id]
    );
    expect(notesAfter.rows[0].count).toBe(1);
  });

  test('admin confirm from manual_review enqueues exactly one customer confirmation', async () => {
    const { pool } = require('../../helpers/dbTestHarness');
    const reservation = await forceManualReview();
    await pool.query('DELETE FROM car_date_blocks WHERE car_id = $1', [carId]);

    const countConfirmations = async () => {
      const r = await pool.query(
        `SELECT COUNT(*)::int AS count FROM notifications
         WHERE reservation_id = $1 AND type = 'reservation_confirmation'`,
        [reservation.id]
      );
      return r.rows[0].count;
    };
    expect(await countConfirmations()).toBe(0);

    const admin = await loginAsAdmin(app);
    const first = await postAdminReservationStatus(admin, reservation.id, {
      status: 'confirmed',
      reason: 'admin_manual_review_confirm',
    });
    expect(first.status).toBe(200);
    expect(await countConfirmations()).toBe(1);

    // Repeating the confirm (already confirmed) must not enqueue another email.
    await postAdminReservationStatus(admin, reservation.id, {
      status: 'confirmed',
      reason: 'admin_manual_review_confirm',
    });
    expect(await countConfirmations()).toBe(1);

    await pool.query('DELETE FROM notifications WHERE reservation_id = $1', [reservation.id]);
  });

  test('rejected confirm while range still blocked enqueues no customer confirmation', async () => {
    const { pool } = require('../../helpers/dbTestHarness');
    const reservation = await forceManualReview();
    // Keep the foreign block so confirm must fail availability checks.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);

    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationStatus(admin, reservation.id, {
      status: 'confirmed',
      reason: 'admin_manual_review_confirm_blocked',
    });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect((await getReservationById(reservation.id)).status).toBe('manual_review');
    expect(await getOrderByReservationId(reservation.id)).toBeFalsy();

    const notes = await pool.query(
      `SELECT COUNT(*)::int AS count FROM notifications
       WHERE reservation_id = $1 AND type = 'reservation_confirmation'`,
      [reservation.id]
    );
    expect(notes.rows[0].count).toBe(0);
  });

  test('admin refund from manual_review leaves booking without order', async () => {
    const reservation = await forceManualReview();
    expect(reservation.stripe_payment_intent_id || reservation.stripe_session_id).toBeTruthy();

    const admin = await loginAsAdmin(app);
    const res = await postAdminReservationRefund(admin, reservation.id, {
      reason: 'admin_manual_review_refund',
    });
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    expect(res.body.data.status).toBe('succeeded');

    const refunded = await getReservationById(reservation.id);
    expect(refunded.status).toBe('refunded');
    expect(await getOrderByReservationId(reservation.id)).toBeFalsy();
    expect(await countOrdersForCar(carId)).toBe(0);
  });
});
