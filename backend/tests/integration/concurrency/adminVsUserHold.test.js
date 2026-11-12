// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createSessionAgent,
  // Contribute this line to the enclosing declaration or statement.
  loginAsAdmin,
  // Contribute this line to the enclosing declaration or statement.
  postOrder,
  // Contribute this line to the enclosing declaration or statement.
  withCsrf,
// Continue the surrounding logic with this statement.
} = require('../helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  buildOrderBody,
  // Contribute this line to the enclosing declaration or statement.
  buildAdminOrderBody,
  // Contribute this line to the enclosing declaration or statement.
  countActiveReservationsForCar,
  // Contribute this line to the enclosing declaration or statement.
  getDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  countOrdersForCar,
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
// Destructure object properties into local variables.
const { parseSofiaDate } = require('../../../src/utils/date/timezone');
// Destructure object properties into local variables.
const { RESERVATION_CONFLICT_MESSAGE } = require('../../../src/services/admin/order/orderConflictService');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('Concurrency integration: adminVsUserHold', () => {
  // Call jest.setTimeout to perform this step.
  jest.setTimeout(60_000);

  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car id variable for later assignment.
  let carId;

  // Register setup that runs before the tests.
  beforeAll(async () => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
  });

  // Register setup that runs before the tests.
  beforeEach(async () => {
    // Store the awaited result in carId.
    carId = await insertIsolatedTestCar({ name: 'Admin Vs User Hold Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('blocks admin order creation while user has an active online hold', async () => {
    // Create the user agent constant.
    const userAgent = await createSessionAgent(app);
    // Create the user hold constant.
    const userHold = await postOrder(userAgent, buildOrderBody(carId));
    // Assert that the value matches the intended expectation.
    expect(userHold.status).toBe(200);

    // Create the admin agent constant.
    const adminAgent = await loginAsAdmin(app);
    // Create the admin create constant.
    const adminCreate = await withCsrf(adminAgent, adminAgent.post('/api/admin/orders')).send(
      // Call buildAdminOrderBody to perform this step.
      buildAdminOrderBody(carId)
    );

    // Assert that the value matches the intended expectation.
    expect(adminCreate.status).toBe(422);
    // Assert that the value matches the intended expectation.
    expect(adminCreate.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(adminCreate.body.error.code).toBe('VALIDATION_ERROR');
    // Assert that the value matches the intended expectation.
    expect(adminCreate.body.error.message).toMatch(/active online reservation/i);
    // Assert that the value matches the intended expectation.
    expect(adminCreate.body.error.message).toBe(RESERVATION_CONFLICT_MESSAGE);

    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(0);
  });

  // Define a single test case and its expectations.
  test('admin create waits on car lock then loses to an overlapping hold', async () => {
    // Create the admin agent constant.
    const adminAgent = await loginAsAdmin(app);
    // Create the competitor constant.
    const competitor = await pool.connect();
    // Create the hold pricing constant.
    const holdPricing = { rentalDays: 4, totalPrice: 200, deliveryPrice: 0, returnPrice: 0 };
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await competitor.query('BEGIN');
      // Wait until the asynchronous operation resolves.
      await acquireCarAdvisoryLock(competitor, carId);

      // Create the admin promise constant.
      const adminPromise = Promise.resolve(
        // Call withCsrf to perform this step.
        withCsrf(adminAgent, adminAgent.post('/api/admin/orders')).send(buildAdminOrderBody(carId))
      );

      // Wait until the asynchronous operation resolves.
      await waitUntilAdvisoryLockWaiter(ADVISORY_LOCK_NS.CAR, carId);

      // Wait until the asynchronous operation resolves.
      await reservationSql.createPendingReservation(
        {
          // Contribute this line to the enclosing declaration or statement.
          carId,
          // Provide the session id field value.
          sessionId: `hold-race-${carId}`,
          // Provide the start date field value.
          startDate: parseSofiaDate('2030-06-01', '10:00'),
          // Provide the end date field value.
          endDate: parseSofiaDate('2030-06-05', '10:00'),
          // Provide the pickup time field value.
          pickupTime: '10:00',
          // Provide the return time field value.
          returnTime: '10:00',
          // Provide the pickup location field value.
          pickupLocation: 'office',
          // Provide the return location field value.
          returnLocation: 'office',
          // Provide the pricing field value.
          pricing: holdPricing,
        },
        // Reference the identifier used by the enclosing expression.
        competitor
      );
      // Wait until the asynchronous operation resolves.
      await competitor.query('COMMIT');

      // Create the admin create constant.
      const adminCreate = await adminPromise;
      // Assert that the value matches the intended expectation.
      expect(adminCreate.status).toBe(422);
      // Assert that the value matches the intended expectation.
      expect(adminCreate.body.success).toBe(false);
      // Assert that the value matches the intended expectation.
      expect(adminCreate.body.error.message).toBe(RESERVATION_CONFLICT_MESSAGE);

      // Assert that the value matches the intended expectation.
      expect(await countActiveReservationsForCar(carId)).toBe(1);
      // Assert that the value matches the intended expectation.
      expect(await countOrdersForCar(carId)).toBe(0);
      // Assert that the value matches the intended expectation.
      expect(await getDateBlocksForCar(carId)).toHaveLength(0);
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
  });
});
