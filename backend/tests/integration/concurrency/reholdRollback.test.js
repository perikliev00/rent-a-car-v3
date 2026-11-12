// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createTwoSessionAgents,
  // Contribute this line to the enclosing declaration or statement.
  postOrder,
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
  countActiveReservationsForCar,
// Continue the surrounding logic with this statement.
} = require('../helpers/dbFixtures');
// Destructure object properties into local variables.
const { pool } = require('../../helpers/dbTestHarness');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('MONEY-001: reholdRollback', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car id variable for later assignment.
  let carId;

  // Register setup that runs before the tests.
  beforeAll(() => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
  });

  // Register setup that runs before the tests.
  beforeEach(async () => {
    // Store the awaited result in carId.
    carId = await insertIsolatedTestCar({ name: 'Rehold Rollback Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('failed release-and-rehold keeps the original hold', async () => {
    // Destructure array values into local variables.
    const [agentA, agentB] = await createTwoSessionAgents(app);
    // Create the body a constant.
    const bodyA = buildOrderBody(carId, {
      // Provide the pickup date field value.
      pickupDate: '2030-07-01',
      // Provide the return date field value.
      returnDate: '2030-07-05',
    });
    // Create the body b constant.
    const bodyB = buildOrderBody(carId, {
      // Provide the pickup date field value.
      pickupDate: '2030-07-10',
      // Provide the return date field value.
      returnDate: '2030-07-14',
    });

    // Assert that the value matches the intended expectation.
    expect((await postOrder(agentA, bodyA)).status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect((await postOrder(agentB, bodyB)).status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carId)).toBe(2);

    // Create the rehold res constant.
    const reholdRes = await postReleaseAndRehold(agentA, {
      // Spread bodyB into the surrounding structure.
      ...bodyB,
      // Provide the pickup time field value.
      pickupTime: '10:00',
      // Provide the return time field value.
      returnTime: '10:00',
    });
    // Assert that the value matches the intended expectation.
    expect(reholdRes.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(reholdRes.body.error.code).toBe('CONFLICT');

    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carId)).toBe(2);

    // Create the holds constant.
    const holds = await pool.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT pickup_date, return_date, status
      FROM reservations
      WHERE car_id = $1
        AND status IN ('pending_payment', 'processing_payment')
        AND hold_expires_at > NOW()
      ORDER BY pickup_date
      `,
      // Contribute this line to the enclosing declaration or statement.
      [carId]
    );

    // Assert that the value matches the intended expectation.
    expect(holds.rows).toHaveLength(2);
    // Assert that the value matches the intended expectation.
    expect(new Date(holds.rows[0].pickup_date).toISOString().startsWith('2030-07-01')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(new Date(holds.rows[1].pickup_date).toISOString().startsWith('2030-07-10')).toBe(true);
  });
});
