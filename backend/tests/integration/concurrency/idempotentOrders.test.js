// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const { createSessionAgent, postOrder } = require('../helpers/sessionAgentFactory');
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

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('Concurrency integration: idempotentOrders', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Idempotent Orders Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('same session and same dates returns success without creating a second hold', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the body constant.
    const body = buildOrderBody(carId);

    // Create the first constant.
    const first = await postOrder(agent, body);
    // Create the second constant.
    const second = await postOrder(agent, body);

    // Assert that the value matches the intended expectation.
    expect(first.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(second.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(first.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(second.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carId)).toBe(1);
  });

  // Define a single test case and its expectations.
  test('same session with different dates returns conflict', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);

    // Create the first constant.
    const first = await postOrder(agent, buildOrderBody(carId));
    // Assert that the value matches the intended expectation.
    expect(first.status).toBe(200);

    // Create the second constant.
    const second = await postOrder(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call buildOrderBody to perform this step.
      buildOrderBody(carId, {
        // Provide the pickup date field value.
        pickupDate: '2030-07-01',
        // Provide the return date field value.
        returnDate: '2030-07-05',
      })
    );

    // Assert that the value matches the intended expectation.
    expect(second.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(second.body.error.code).toBe('CONFLICT');
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carId)).toBe(1);
  });
});
