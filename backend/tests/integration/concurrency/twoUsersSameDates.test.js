// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const { createTwoSessionAgents, postOrder } = require('../helpers/sessionAgentFactory');
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
  // Contribute this line to the enclosing declaration or statement.
  countOrdersForCar,
// Continue the surrounding logic with this statement.
} = require('../helpers/dbFixtures');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('Concurrency integration: twoUsersSameDates', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Two Users Test Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('parallel POST /api/orders allows exactly one hold for the same car and dates', async () => {
    // Destructure array values into local variables.
    const [agentA, agentB] = await createTwoSessionAgents(app);
    // Create the body constant.
    const body = buildOrderBody(carId);

    // Destructure array values into local variables.
    const [resA, resB] = await Promise.all([
      // Call postOrder to perform this step.
      postOrder(agentA, body),
      // Call postOrder to perform this step.
      postOrder(agentB, body),
    ]);

    // Create the statuses constant.
    const statuses = [resA.status, resB.status].sort();
    // Assert that the value matches the intended expectation.
    expect(statuses).toEqual([200, 409]);

    // Create the winner constant.
    const winner = resA.status === 200 ? resA : resB;
    // Create the loser constant.
    const loser = resA.status === 409 ? resA : resB;

    // Assert that the value matches the intended expectation.
    expect(winner.body.success).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(loser.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(loser.body.error.code).toBe('CONFLICT');

    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(0);
  });
});
