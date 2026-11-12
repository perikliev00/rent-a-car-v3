// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
// Destructure object properties into local variables.
const { createSessionAgent, loginAsAdmin, withCsrf } = require('./helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
  // Contribute this line to the enclosing declaration or statement.
  insertLinkedBooking,
  // Contribute this line to the enclosing declaration or statement.
  cleanupReservationsForCar,
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
describeIf('ADMIN-013: adminDeleteBookedCar', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car id variable for later assignment.
  let carId;
  // Create the car name constant.
  const carName = `Delete Booked Car ${Date.now()}`;

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
    carId = await insertIsolatedTestCar({ name: carName });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('DELETE returns 409 while confirmed booking exists; succeeds after cleanup', async () => {
    // Wait until the asynchronous operation resolves.
    await insertLinkedBooking({
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the status field value.
      status: 'confirmed',
      // Provide the pickup date field value.
      pickupDate: '2031-04-01',
      // Provide the return date field value.
      returnDate: '2031-04-04',
      // Provide the guest field value.
      guest: { email: `booked-car-${Date.now()}@example.com`, fullName: 'Booked Car Guest' },
    });

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the blocked constant.
    const blocked = await withCsrf(admin, admin.delete(`/api/admin/cars/${carId}`));
    // Assert that the value matches the intended expectation.
    expect(blocked.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(blocked.body?.error?.code || blocked.body?.code).toBe('CONFLICT');

    // Create the public agent constant.
    const publicAgent = await createSessionAgent(app);
    // Create the still listed constant.
    const stillListed = await publicAgent.get('/api/cars');
    // Create the still cars constant.
    const stillCars = stillListed.body?.data?.cars ?? stillListed.body?.cars ?? [];
    // Assert that the value matches the intended expectation.
    expect(stillCars.some((c) => Number(c.id) === carId || c.name === carName)).toBe(true);

    // Wait until the asynchronous operation resolves.
    await cleanupReservationsForCar(carId);

    // Create the allowed constant.
    const allowed = await withCsrf(admin, admin.delete(`/api/admin/cars/${carId}`));
    // Assert that the value matches the intended expectation.
    expect(allowed.status).toBe(200);

    // Create the after delete constant.
    const afterDelete = await publicAgent.get('/api/cars');
    // Create the after cars constant.
    const afterCars = afterDelete.body?.data?.cars ?? afterDelete.body?.cars ?? [];
    // Assert that the value matches the intended expectation.
    expect(afterCars.some((c) => Number(c.id) === carId || c.name === carName)).toBe(false);

    // Update carId with the right-hand side value.
    carId = null;
  });
});
