// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const { createSessionAgent, postOrder, postCheckout } = require('../helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildCheckoutCompletedEvent,
  // Contribute this line to the enclosing declaration or statement.
  postSignedWebhook,
// Continue the surrounding logic with this statement.
} = require('../helpers/stripeWebhookFactory');
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
  // Contribute this line to the enclosing declaration or statement.
  getOrderByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  getDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  countProcessedStripeEvents,
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
describeIf('Concurrency integration: duplicateWebhook', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Duplicate Webhook Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('replays the same checkout.session.completed event idempotently', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId);

    // Create the order res constant.
    const orderRes = await postOrder(agent, checkoutBody);
    // Assert that the value matches the intended expectation.
    expect(orderRes.status).toBe(200);
    // Create the checkout res constant.
    const checkoutRes = await postCheckout(agent, checkoutBody);
    // Assert that the value matches the intended expectation.
    expect(checkoutRes.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(checkoutRes.body.data.checkoutUrl).toBeTruthy();

    // Create the stripe session id constant.
    const stripeSessionId = checkoutRes.body.data.checkoutUrl
      // Call .split to perform this step.
      .split('session_id=')
      // Call .pop to perform this step.
      .pop()
      // Continue the surrounding logic with this statement.
      ?.split('&')[0];
    // Assert that the value matches the intended expectation.
    expect(stripeSessionId).toMatch(/^cs_test_/);

    // Create the reservation constant.
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(reservation).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('processing_payment');

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: 'evt_duplicate_integration_1',
      // Provide the session id field value.
      sessionId: stripeSessionId,
      // Provide the reservation id field value.
      reservationId: reservation.id,
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the session id meta field value.
      sessionIdMeta: reservation.session_id,
      // Provide the amount total field value.
      amountTotal: Math.round(Number(reservation.total_price) * 100),
    });

    // Create the first constant.
    const first = await postSignedWebhook(app, event);
    // Create the second constant.
    const second = await postSignedWebhook(app, event);

    // Assert that the value matches the intended expectation.
    expect(first.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(first.body).toEqual({ received: true });
    // Assert that the value matches the intended expectation.
    expect(second.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(second.body).toEqual({ received: true });

    // Create the updated reservation constant.
    const updatedReservation = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(updatedReservation.status).toBe('confirmed');

    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(await countProcessedStripeEvents('evt_duplicate_integration_1')).toBe(1);
  });
});
