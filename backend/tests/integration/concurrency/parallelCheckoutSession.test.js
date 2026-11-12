// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createSessionAgent,
  // Contribute this line to the enclosing declaration or statement.
  postOrder,
  // Contribute this line to the enclosing declaration or statement.
  postCheckout,
// Continue the surrounding logic with this statement.
} = require('../helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  insertIsolatedTestCar,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestCar,
  // Contribute this line to the enclosing declaration or statement.
  buildCheckoutBody,
  // Contribute this line to the enclosing declaration or statement.
  getReservationByStripeSessionId,
// Continue the surrounding logic with this statement.
} = require('../helpers/dbFixtures');
// Require the '../../../src/services/payment/stripeTestStub' module as stripeTestStub.
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Define the extractStripeSessionId function.
function extractStripeSessionId(checkoutRes) {
  // Return the resulting value to the caller.
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

// Call describeIf to perform this step.
describeIf('parallel checkout create-and-link', () => {
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
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
    // Store the awaited result in carId.
    carId = await insertIsolatedTestCar({ name: 'Parallel Checkout Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define a single test case and its expectations.
  test('two concurrent checkouts for the same reservation create one payable Stripe session', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId, {
      // Provide the email field value.
      email: 'parallel-checkout@example.com',
    });

    // Assert that the value matches the intended expectation.
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);

    // Destructure array values into local variables.
    const [first, second] = await Promise.all([
      // Call postCheckout to perform this step.
      postCheckout(agent, checkoutBody),
      // Call postCheckout to perform this step.
      postCheckout(agent, checkoutBody),
    ]);

    // Assert that the value matches the intended expectation.
    expect(first.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(second.status).toBe(200);

    // Create the first session id constant.
    const firstSessionId = extractStripeSessionId(first);
    // Create the second session id constant.
    const secondSessionId = extractStripeSessionId(second);
    // Assert that the value matches the intended expectation.
    expect(firstSessionId).toBe(secondSessionId);
    // Assert that the value matches the intended expectation.
    expect(stripeTestStub.sessions.size).toBe(1);

    // Create the reservation constant.
    const reservation = await getReservationByStripeSessionId(firstSessionId);
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(reservation.stripe_session_id).toBe(firstSessionId);
  });
});
