// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin, postAdminReservationStatus } = require('./helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
  // Contribute this line to the enclosing declaration or statement.
  insertLinkedBooking,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getStatusHistory,
  // Contribute this line to the enclosing declaration or statement.
  getDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
// Continue the surrounding logic with this statement.
} = require('./helpers/dbFixtures');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('ADMIN-005: adminInvalidTransition', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Invalid Transition Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('illegal confirmed→completed is rejected without history or block changes', async () => {
    // Create the seeded constant.
    const seeded = await insertLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the pickup date field value.
      pickupDate: '2031-05-01',
      // Provide the return date field value.
      returnDate: '2031-05-04',
      // Provide the guest field value.
      guest: { email: `invalid-tx-${Date.now()}@example.com` },
    });
    // Create the blocks before constant.
    const blocksBefore = (await getDateBlocksForCar(carId)).length;
    // Create the history before constant.
    const historyBefore = await getStatusHistory(seeded.reservationId);

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the result constant.
    const result = await postAdminReservationStatus(admin, seeded.reservationId, {
      // Provide the status field value.
      status: 'completed',
    });
    // Assert that the value matches the intended expectation.
    expect(result.status >= 400).toBe(true);

    // Create the still constant.
    const still = await getReservationById(seeded.reservationId);
    // Assert that the value matches the intended expectation.
    expect(still.status).toBe('confirmed');

    // Create the history after constant.
    const historyAfter = await getStatusHistory(seeded.reservationId);
    // Assert that the value matches the intended expectation.
    expect(historyAfter.length).toBe(historyBefore.length);
    // Assert that the value matches the intended expectation.
    expect(historyAfter.some((h) => h.new_status === 'completed')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect((await getDateBlocksForCar(carId)).length).toBe(blocksBefore);
  });
});
