const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  createTwoSessionAgents,
  postOrder,
  postCheckout,
  postReleaseAndRehold,
} = require('../helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  buildOrderBody,
  buildCheckoutBody,
  countActiveReservationsForCar,
  countActiveReservationsForSession,
  countReservationsForSession,
  countReholdHistory,
  getActiveReservationForCar,
  getReservationById,
} = require('../helpers/dbFixtures');
const { waitUntilAdvisoryLockWaiter, ADVISORY_LOCK_NS } = require('../helpers/lockBarrier');
const { pool } = require('../../helpers/dbTestHarness');
const { acquireCarAdvisoryLock } = require('../../../src/db/transaction');
const reservationSql = require('../../../src/services/sql/reservationSqlService');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

const HOLD_PRICING = { rentalDays: 4, totalPrice: 200, deliveryPrice: 0, returnPrice: 0 };

describeIf('Concurrency integration: session hold locking', () => {
  let app;
  let carA;
  let carB;
  let carC;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carA = await insertIsolatedTestCar({ name: 'Session Lock Car A' });
    carB = await insertIsolatedTestCar({ name: 'Session Lock Car B' });
    carC = await insertIsolatedTestCar({ name: 'Session Lock Car C' });
  });

  afterEach(async () => {
    await pool.query('DROP TRIGGER IF EXISTS test_fail_rehold_history_trg ON reservation_status_history');
    await pool.query('DROP FUNCTION IF EXISTS test_fail_rehold_history()');
    await cleanupTestCar(carA);
    await cleanupTestCar(carB);
    await cleanupTestCar(carC);
  });

  test('successful rehold updates the same reservation row', async () => {
    const agent = await createSessionAgent(app);
    const bodyA = buildOrderBody(carA);
    const bodyB = buildOrderBody(carB);

    expect((await postOrder(agent, bodyA)).status).toBe(200);
    const original = await getActiveReservationForCar(carA);
    expect(original).toBeTruthy();
    const originalId = Number(original.id);
    const sessionId = original.session_id;

    const reholdRes = await postReleaseAndRehold(agent, {
      ...bodyB,
      pickupTime: '10:00',
      returnTime: '10:00',
    });
    expect(reholdRes.status).toBe(200);
    expect(reholdRes.body.success).toBe(true);

    expect(await countActiveReservationsForCar(carA)).toBe(0);
    expect(await countActiveReservationsForCar(carB)).toBe(1);
    expect(await countActiveReservationsForSession(sessionId)).toBe(1);
    expect(await countReservationsForSession(sessionId)).toBe(1);

    const moved = await getReservationById(originalId);
    expect(moved).toBeTruthy();
    expect(Number(moved.car_id)).toBe(carB);
    expect(moved.status).toBe('pending_payment');
    expect(await countReholdHistory(originalId)).toBe(1);
  });

  test('real race on the target car keeps the original hold', async () => {
    const [agentA] = await createTwoSessionAgents(app);
    const bodyA = buildOrderBody(carA);
    const bodyB = buildOrderBody(carB);

    expect((await postOrder(agentA, bodyA)).status).toBe(200);
    const original = await getActiveReservationForCar(carA);
    expect(original).toBeTruthy();
    const originalSnapshot = await getReservationById(original.id);
    const sessionId = original.session_id;
    const competitorSessionId = `competitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const competitor = await pool.connect();
    try {
      await competitor.query('BEGIN');
      await acquireCarAdvisoryLock(competitor, carB);
      await reservationSql.createPendingReservation(
        {
          carId: carB,
          sessionId: competitorSessionId,
          startDate: original.pickup_date,
          endDate: original.return_date,
          pickupTime: '10:00',
          returnTime: '10:00',
          pickupLocation: 'office',
          returnLocation: 'office',
          pricing: HOLD_PRICING,
        },
        competitor
      );

      const reholdPromise = postReleaseAndRehold(agentA, {
        ...bodyB,
        pickupTime: '10:00',
        returnTime: '10:00',
      });

      await waitUntilAdvisoryLockWaiter(ADVISORY_LOCK_NS.CAR, carB);
      await competitor.query('COMMIT');

      const reholdRes = await reholdPromise;
      expect(reholdRes.status).toBe(409);
      expect(reholdRes.body.error.code).toBe('CONFLICT');
    } finally {
      try {
        await competitor.query('ROLLBACK');
      } catch {
        // already committed
      }
      competitor.release();
    }

    const after = await getReservationById(original.id);
    expect(after).toBeTruthy();
    expect(Number(after.id)).toBe(Number(originalSnapshot.id));
    expect(Number(after.car_id)).toBe(carA);
    expect(after.status).toBe(originalSnapshot.status);
    expect(Number(after.total_price)).toBe(Number(originalSnapshot.total_price));
    expect(new Date(after.pickup_date).getTime()).toBe(
      new Date(originalSnapshot.pickup_date).getTime()
    );
    expect(new Date(after.return_date).getTime()).toBe(
      new Date(originalSnapshot.return_date).getTime()
    );
    expect(await countActiveReservationsForSession(sessionId)).toBe(1);
    expect(await countActiveReservationsForCar(carA)).toBe(1);
    expect(await countActiveReservationsForCar(carB)).toBe(1);
    expect(await countReservationsForSession(sessionId)).toBe(1);
  });

  test('two concurrent reholds from one session leave a single active row', async () => {
    const agent = await createSessionAgent(app);
    expect((await postOrder(agent, buildOrderBody(carA))).status).toBe(200);
    const original = await getActiveReservationForCar(carA);
    expect(original).toBeTruthy();
    const originalId = Number(original.id);
    const sessionId = original.session_id;

    const [resB, resC] = await Promise.all([
      postReleaseAndRehold(agent, { ...buildOrderBody(carB), pickupTime: '10:00', returnTime: '10:00' }),
      postReleaseAndRehold(agent, { ...buildOrderBody(carC), pickupTime: '10:00', returnTime: '10:00' }),
    ]);

    expect([resB.status, resC.status].every((status) => status < 500)).toBe(true);
    expect([resB.status, resC.status].some((status) => status === 200)).toBe(true);

    expect(await countActiveReservationsForSession(sessionId)).toBe(1);
    expect(await countReservationsForSession(sessionId)).toBe(1);

    const finalRow = await getReservationById(originalId);
    expect(finalRow).toBeTruthy();
    expect(finalRow.status).toBe('pending_payment');
    expect([carB, carC]).toContain(Number(finalRow.car_id));
    expect(await countActiveReservationsForCar(carA)).toBe(0);
  });

  test('two concurrent initial orders for different cars keep one hold', async () => {
    const agent = await createSessionAgent(app);

    const [resA, resB] = await Promise.all([
      postOrder(agent, buildOrderBody(carA)),
      postOrder(agent, buildOrderBody(carB)),
    ]);

    expect([resA.status, resB.status].every((status) => status === 200 || status === 409)).toBe(
      true
    );
    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);
    expect(resA.status === 409 ? resA.body.error.code : resB.body.error.code).toBe('CONFLICT');

    const holdA = await getActiveReservationForCar(carA);
    const holdB = await getActiveReservationForCar(carB);
    const winner = holdA || holdB;
    expect(winner).toBeTruthy();
    expect(Boolean(holdA) !== Boolean(holdB)).toBe(true);
    expect(await countActiveReservationsForSession(winner.session_id)).toBe(1);
    expect(await countReservationsForSession(winner.session_id)).toBe(1);
  });

  test('processing_payment reservation cannot be moved', async () => {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carA);
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);

    const checkoutRes = await postCheckout(agent, checkoutBody);
    expect(checkoutRes.status).toBe(200);

    const original = await getActiveReservationForCar(carA);
    expect(original).toBeTruthy();
    expect(original.status).toBe('processing_payment');
    expect(original.stripe_session_id).toBeTruthy();
    const snapshot = await getReservationById(original.id);

    const reholdRes = await postReleaseAndRehold(agent, {
      ...buildOrderBody(carB),
      pickupTime: '10:00',
      returnTime: '10:00',
    });
    expect(reholdRes.status).toBe(409);
    expect(reholdRes.body.error.code).toBe('REHOLD_NOT_ALLOWED');

    const after = await getReservationById(original.id);
    expect(Number(after.car_id)).toBe(carA);
    expect(after.status).toBe('processing_payment');
    expect(after.stripe_session_id).toBe(snapshot.stripe_session_id);
    expect(Number(after.total_price)).toBe(Number(snapshot.total_price));
    expect(await countActiveReservationsForCar(carB)).toBe(0);
    expect(await countReservationsForSession(original.session_id)).toBe(1);
  });

  test('rehold DB error rolls back the original hold and history', async () => {
    const agent = await createSessionAgent(app);
    expect((await postOrder(agent, buildOrderBody(carA))).status).toBe(200);
    const original = await getActiveReservationForCar(carA);
    expect(original).toBeTruthy();
    const snapshot = await getReservationById(original.id);

    await pool.query(`
      CREATE OR REPLACE FUNCTION test_fail_rehold_history() RETURNS trigger AS $$
      BEGIN
        IF NEW.reason = 'customer_reheld' THEN
          RAISE EXCEPTION 'test_forced_rehold_history_failure' USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await pool.query(`
      DROP TRIGGER IF EXISTS test_fail_rehold_history_trg ON reservation_status_history;
      CREATE TRIGGER test_fail_rehold_history_trg
      BEFORE INSERT ON reservation_status_history
      FOR EACH ROW EXECUTE PROCEDURE test_fail_rehold_history();
    `);

    const reholdRes = await postReleaseAndRehold(agent, {
      ...buildOrderBody(carB),
      pickupTime: '10:00',
      returnTime: '10:00',
    });
    expect(reholdRes.status).toBeGreaterThanOrEqual(500);

    const after = await getReservationById(original.id);
    expect(Number(after.car_id)).toBe(carA);
    expect(after.status).toBe(snapshot.status);
    expect(Number(after.total_price)).toBe(Number(snapshot.total_price));
    expect(new Date(after.pickup_date).getTime()).toBe(new Date(snapshot.pickup_date).getTime());
    expect(await countReholdHistory(original.id)).toBe(0);
    expect(await countActiveReservationsForSession(original.session_id)).toBe(1);
    expect(await countReservationsForSession(original.session_id)).toBe(1);
    expect(await countActiveReservationsForCar(carA)).toBe(1);
    expect(await countActiveReservationsForCar(carB)).toBe(0);
  });
});
