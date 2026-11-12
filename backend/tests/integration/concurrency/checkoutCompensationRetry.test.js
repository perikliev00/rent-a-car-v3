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
  getActiveReservationForCar,
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  countActiveReservationsForCar,
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

// Call describeIf to perform this step.
describeIf('MONEY-008: checkoutCompensationRetry', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Checkout Compensation Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define a single test case and its expectations.
  test('create failure after existing hold keeps hold and allows retry', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId, { email: 'checkout-comp@example.com' });

    // Assert that the value matches the intended expectation.
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    // Create the hold constant.
    const hold = await getActiveReservationForCar(carId);
    // Assert that the value matches the intended expectation.
    expect(hold).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(hold.status).toBe('pending_payment');

    // Call stripeTestStub.failNextCreateSession to perform this step.
    stripeTestStub.failNextCreateSession();
    // Create the failed checkout constant.
    const failedCheckout = await postCheckout(agent, checkoutBody);
    // Assert that the value matches the intended expectation.
    expect(failedCheckout.status).toBe(422);
    // Assert that the value matches the intended expectation.
    expect(failedCheckout.body.error.code).toBe('CHECKOUT_ERROR');

    // Create the after fail constant.
    const afterFail = await getReservationById(hold.id);
    // Assert that the value matches the intended expectation.
    expect(afterFail.status).toBe('pending_payment');
    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carId)).toBe(1);

    // Create the retry constant.
    const retry = await postCheckout(agent, checkoutBody);
    // Assert that the value matches the intended expectation.
    expect(retry.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(retry.body.data.checkoutUrl).toContain('session_id=');

    // Create the processing constant.
    const processing = await getReservationById(hold.id);
    // Assert that the value matches the intended expectation.
    expect(processing.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(processing.stripe_session_id).toBeTruthy();
  });

  // Define a single test case and its expectations.
  test('create failure when hold created this step cancels the new hold', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId, {
      // Provide the email field value.
      email: 'checkout-new-hold@example.com',
      // Provide the pickup date field value.
      pickupDate: '2030-08-01',
      // Provide the return date field value.
      returnDate: '2030-08-05',
    });

    // Call stripeTestStub.failNextCreateSession to perform this step.
    stripeTestStub.failNextCreateSession();
    // Create the failed checkout constant.
    const failedCheckout = await postCheckout(agent, checkoutBody);
    // Assert that the value matches the intended expectation.
    expect(failedCheckout.status).toBe(422);
    // Assert that the value matches the intended expectation.
    expect(failedCheckout.body.error.code).toBe('CHECKOUT_ERROR');

    // Assert that the value matches the intended expectation.
    expect(await countActiveReservationsForCar(carId)).toBe(0);
  });
});
