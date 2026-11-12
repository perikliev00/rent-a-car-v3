// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createSessionAgent,
  // Contribute this line to the enclosing declaration or statement.
  createTwoSessionAgents,
  // Contribute this line to the enclosing declaration or statement.
  postOrder,
  // Contribute this line to the enclosing declaration or statement.
  postCheckout,
  // Contribute this line to the enclosing declaration or statement.
  postReleaseAndRehold,
// Continue the surrounding logic with this statement.
} = require('../helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderBody,
  // Contribute this line to the enclosing declaration or statement.
  buildCheckoutBody,
  // Contribute this line to the enclosing declaration or statement.
  countActiveReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  countActiveReservationsForSession,
  // Contribute this line to the enclosing declaration or statement.
  countReservationsForSession,
  // Contribute this line to the enclosing declaration or statement.
  countReholdHistory,
  // Contribute this line to the enclosing declaration or statement.
  getActiveReservationForCar,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
// Continue the surrounding logic with this statement.
} = require('../helpers/dbFixtures');
// Destructure object properties into local variables.
const { waitUntilAdvisoryLockWaiter, ADVISORY_LOCK_NS } = require('../helpers/lockBarrier');
// Destructure object properties into local variables.
const { pool } = require('../../helpers/dbTestHarness');
// Destructure object properties into local variables.
const { acquireCarAdvisoryLock } = require('../../../src/db/transaction');
// Require the '../../../src/services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../../src/services/sql/reservationSqlService');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Create the hold pricing constant.
const HOLD_PRICING = { rentalDays: 4, totalPrice: 200, deliveryPrice: 0, returnPrice: 0 };

// Call describeIf to perform this step.
describeIf('Concurrency integration: session hold locking', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car a variable for later assignment.
  let carA;
  // Reserve the car b variable for later assignment.
  let carB;
  // Reserve the car c variable for later assignment.
  let carC;

  // Register setup that runs before the tests.
  beforeAll(() => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
  });

  // Register setup that runs before the tests.
  beforeEach(async () => {
    // Store the awaited result in carA.
    carA = await insertIsolatedTestCar({ name: 'Session Lock Car A' });
    // Store the awaited result in carB.
    carB = await insertIsolatedTestCar({ name: 'Session Lock Car B' });
    // Store the awaited result in carC.
    carC = await insertIsolatedTestCar({ name: 'Session Lock Car C' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await pool.query('DROP TRIGGER IF EXISTS test_fail_rehold_history_trg ON reservation_status_history');
    // Wait until the asynchronous operation resolves.
    await pool.query('DROP FUNCTION IF EXISTS test_fail_rehold_history()');
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carA);
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carB);
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carC);
  });

  // Define a single test case and its expectations.
  test('successful rehold updates the same reservation row', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the body a constant.
    const bodyA = buildOrderBody(carA);
    // Create the body b constant.
    const bodyB = buildOrderBody(carB);

    // Assert that the value matches the intended expectation.
    expect((await postOrder(agent, bodyA)).status).toBe(200);
    // Create the original constant.
    const original = await getActiveReservationForCar(carA);
    // Assert that the value matches the intended expectation.
    expect(original).toBeTruthy();
    // Create the original id constant.
    const originalId = Number(original.id);
    // Create the session id constant.
    const sessionId = original.session_id;

    // Create the rehold res constant.
    const reholdRes = await postReleaseAndRehold(agent, {
      // Spread bodyB into the surrounding structure.
      ...bodyB,
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
    });
    // Assert that the value matches the intended expectation.
    expect(reholdRes.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(reholdRes.body.success).toBe(true);

    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carA)).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carB)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForSession(sessionId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countReservationsForSession(sessionId)).toBe(1);

    // Create the moved constant.
    const moved = await getReservationById(originalId);
    // Assert that the value matches the intended expectation.
    expect(moved).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(Number(moved.car_id)).toBe(carB);
    // Assert that the value matches the intended expectation.
    expect(moved.status).toBe('pending_payment');
    // Assert that the value matches the intended expectation.
    expect(await countReholdHistory(originalId)).toBe(1);
  });

  // Define a single test case and its expectations.
  test('real race on the target car keeps the original hold', async () => {
    // Destructure array values into local variables.
    const [agentA] = await createTwoSessionAgents(app);
    // Create the body a constant.
    const bodyA = buildOrderBody(carA);
    // Create the body b constant.
    const bodyB = buildOrderBody(carB);

    // Assert that the value matches the intended expectation.
    expect((await postOrder(agentA, bodyA)).status).toBe(200);
    // Create the original constant.
    const original = await getActiveReservationForCar(carA);
    // Assert that the value matches the intended expectation.
    expect(original).toBeTruthy();
    // Create the original snapshot constant.
    const originalSnapshot = await getReservationById(original.id);
    // Create the session id constant.
    const sessionId = original.session_id;
    // Create the competitor session id constant.
    const competitorSessionId = `competitor-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    // Create the competitor constant.
    const competitor = await pool.connect();
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await competitor.query('BEGIN');
      // Wait until the asynchronous operation resolves.
      await acquireCarAdvisoryLock(competitor, carB);
      // Wait until the asynchronous operation resolves.
      await reservationSql.createPendingReservation(
        {
          // Provide the car id field value.
          carId: carB,
          // Provide the session id field value.
          sessionId: competitorSessionId,
          // Provide the start date field value.
          startDate: original.pickup_date,
          // Provide the end date field value.
          endDate: original.return_date,
          // Provide the pickup time field value.
          pickupTime: '10:00',
          // Provide the return time field value.
          returnTime: '10:00',
          // Provide the pickup location field value.
          pickupLocation: 'office',
          // Provide the return location field value.
          returnLocation: 'office',
          // Provide the pricing field value.
          pricing: HOLD_PRICING,
        },
        // Reference the identifier used by the enclosing expression.
        competitor
      );

      // Create the rehold promise constant.
      const reholdPromise = postReleaseAndRehold(agentA, {
        // Spread bodyB into the surrounding structure.
        ...bodyB,
        // Provide the pickup time field value.
        pickupTime: '10:00',
        // Provide the return time field value.
        returnTime: '10:00',
      });

      // Wait until the asynchronous operation resolves.
      await waitUntilAdvisoryLockWaiter(ADVISORY_LOCK_NS.CAR, carB);
      // Wait until the asynchronous operation resolves.
      await competitor.query('COMMIT');

      // Create the rehold res constant.
      const reholdRes = await reholdPromise;
      // Assert that the value matches the intended expectation.
      expect(reholdRes.status).toBe(409);
      // Assert that the value matches the intended expectation.
      expect(reholdRes.body.error.code).toBe('CONFLICT');
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await competitor.query('ROLLBACK');
      // Contribute this line to the enclosing declaration or statement.
      } catch {
        // already committed
      }
      // Call competitor.release to perform this step.
      competitor.release();
    }

    // Create the after constant.
    const after = await getReservationById(original.id);
    // Assert that the value matches the intended expectation.
    expect(after).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(Number(after.id)).toBe(Number(originalSnapshot.id));
    // Assert that the value matches the intended expectation.
    expect(Number(after.car_id)).toBe(carA);
    // Assert that the value matches the intended expectation.
    expect(after.status).toBe(originalSnapshot.status);
    // Assert that the value matches the intended expectation.
    expect(Number(after.total_price)).toBe(Number(originalSnapshot.total_price));
    // Assert that the value matches the intended expectation.
    expect(new Date(after.pickup_date).getTime()).toBe(
      // Continue the surrounding logic with this statement.
      new Date(originalSnapshot.pickup_date).getTime()
    );
    // Assert that the value matches the intended expectation.
    expect(new Date(after.return_date).getTime()).toBe(
      // Continue the surrounding logic with this statement.
      new Date(originalSnapshot.return_date).getTime()
    );
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForSession(sessionId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carA)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carB)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countReservationsForSession(sessionId)).toBe(1);
  });

  // Define a single test case and its expectations.
  test('two concurrent reholds from one session leave a single active row', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Assert that the value matches the intended expectation.
    expect((await postOrder(agent, buildOrderBody(carA))).status).toBe(200);
    // Create the original constant.
    const original = await getActiveReservationForCar(carA);
    // Assert that the value matches the intended expectation.
    expect(original).toBeTruthy();
    // Create the original id constant.
    const originalId = Number(original.id);
    // Create the session id constant.
    const sessionId = original.session_id;

    // Destructure array values into local variables.
    const [resB, resC] = await Promise.all([
      // Call postReleaseAndRehold to perform this step.
      postReleaseAndRehold(agent, { ...buildOrderBody(carB), pickupTime: '10:00', returnTime: '10:00' }),
      // Call postReleaseAndRehold to perform this step.
      postReleaseAndRehold(agent, { ...buildOrderBody(carC), pickupTime: '10:00', returnTime: '10:00' }),
    ]);

    // Assert that the value matches the intended expectation.
    expect([resB.status, resC.status].every((status) => status < 500)).toBe(true);
    // Assert that the value matches the intended expectation.
    expect([resB.status, resC.status].some((status) => status === 200)).toBe(true);

    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForSession(sessionId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countReservationsForSession(sessionId)).toBe(1);

    // Create the final row constant.
    const finalRow = await getReservationById(originalId);
    // Assert that the value matches the intended expectation.
    expect(finalRow).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(finalRow.status).toBe('pending_payment');
    // Assert that the value matches the intended expectation.
    expect([carB, carC]).toContain(Number(finalRow.car_id));
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carA)).toBe(0);
  });

  // Define a single test case and its expectations.
  test('two concurrent initial orders for different cars keep one hold', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);

    // Destructure array values into local variables.
    const [resA, resB] = await Promise.all([
      // Call postOrder to perform this step.
      postOrder(agent, buildOrderBody(carA)),
      // Call postOrder to perform this step.
      postOrder(agent, buildOrderBody(carB)),
    ]);

    // Assert that the value matches the intended expectation.
    expect([resA.status, resB.status].every((status) => status === 200 || status === 409)).toBe(
      // Supply the literal value used by the enclosing expression.
      true
    );
    // Create the statuses constant.
    const statuses = [resA.status, resB.status].sort();
    // Assert that the value matches the intended expectation.
    expect(statuses).toEqual([200, 409]);
    // Assert that the value matches the intended expectation.
    expect(resA.status === 409 ? resA.body.error.code : resB.body.error.code).toBe('CONFLICT');

    // Create the hold a constant.
    const holdA = await getActiveReservationForCar(carA);
    // Create the hold b constant.
    const holdB = await getActiveReservationForCar(carB);
    // Create the winner constant.
    const winner = holdA || holdB;
    // Assert that the value matches the intended expectation.
    expect(winner).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(Boolean(holdA) !== Boolean(holdB)).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForSession(winner.session_id)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countReservationsForSession(winner.session_id)).toBe(1);
  });

  // Define a single test case and its expectations.
  test('processing_payment reservation cannot be moved', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carA);
    // Assert that the value matches the intended expectation.
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);

    // Create the checkout res constant.
    const checkoutRes = await postCheckout(agent, checkoutBody);
    // Assert that the value matches the intended expectation.
    expect(checkoutRes.status).toBe(200);

    // Create the original constant.
    const original = await getActiveReservationForCar(carA);
    // Assert that the value matches the intended expectation.
    expect(original).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(original.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(original.stripe_session_id).toBeTruthy();
    // Create the snapshot constant.
    const snapshot = await getReservationById(original.id);

    // Create the rehold res constant.
    const reholdRes = await postReleaseAndRehold(agent, {
      // Call ...buildOrderBody to perform this step.
      ...buildOrderBody(carB),
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
    });
    // Assert that the value matches the intended expectation.
    expect(reholdRes.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(reholdRes.body.error.code).toBe('REHOLD_NOT_ALLOWED');

    // Create the after constant.
    const after = await getReservationById(original.id);
    // Assert that the value matches the intended expectation.
    expect(Number(after.car_id)).toBe(carA);
    // Assert that the value matches the intended expectation.
    expect(after.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(after.stripe_session_id).toBe(snapshot.stripe_session_id);
    // Assert that the value matches the intended expectation.
    expect(Number(after.total_price)).toBe(Number(snapshot.total_price));
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carB)).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(await countReservationsForSession(original.session_id)).toBe(1);
  });

  // Define a single test case and its expectations.
  test('rehold DB error rolls back the original hold and history', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Assert that the value matches the intended expectation.
    expect((await postOrder(agent, buildOrderBody(carA))).status).toBe(200);
    // Create the original constant.
    const original = await getActiveReservationForCar(carA);
    // Assert that the value matches the intended expectation.
    expect(original).toBeTruthy();
    // Create the snapshot constant.
    const snapshot = await getReservationById(original.id);

    // Wait until the asynchronous operation resolves.
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
    // Wait until the asynchronous operation resolves.
    await pool.query(`
      DROP TRIGGER IF EXISTS test_fail_rehold_history_trg ON reservation_status_history;
      CREATE TRIGGER test_fail_rehold_history_trg
      BEFORE INSERT ON reservation_status_history
      FOR EACH ROW EXECUTE PROCEDURE test_fail_rehold_history();
    `);

    // Create the rehold res constant.
    const reholdRes = await postReleaseAndRehold(agent, {
      // Call ...buildOrderBody to perform this step.
      ...buildOrderBody(carB),
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
    });
    // Assert that the value matches the intended expectation.
    expect(reholdRes.status).toBeGreaterThanOrEqual(500);

    // Create the after constant.
    const after = await getReservationById(original.id);
    // Assert that the value matches the intended expectation.
    expect(Number(after.car_id)).toBe(carA);
    // Assert that the value matches the intended expectation.
    expect(after.status).toBe(snapshot.status);
    // Assert that the value matches the intended expectation.
    expect(Number(after.total_price)).toBe(Number(snapshot.total_price));
    // Assert that the value matches the intended expectation.
    expect(new Date(after.pickup_date).getTime()).toBe(new Date(snapshot.pickup_date).getTime());
    // Assert that the value matches the intended expectation.
    expect(await countReholdHistory(original.id)).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForSession(original.session_id)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countReservationsForSession(original.session_id)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carA)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carB)).toBe(0);
  });
});
