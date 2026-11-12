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
  setHoldExpired,
  // Contribute this line to the enclosing declaration or statement.
  insertDateBlock,
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
describeIf('Concurrency integration: webhookAfterHoldExpiry', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Hold Expiry Webhook Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define the async function checkoutToProcessing.
  async function checkoutToProcessing(agent) {
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

    // Create the stripe session id constant.
    const stripeSessionId = checkoutRes.body.data.checkoutUrl
      // Call .split to perform this step.
      .split('session_id=')
      // Call .pop to perform this step.
      .pop()
      // Continue the surrounding logic with this statement.
      ?.split('&')[0];

    // Create the reservation constant.
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    // Return the resulting value to the caller.
    return { stripeSessionId, reservation };
  }

  // Define a single test case and its expectations.
  test('4a: expired hold with clear availability still finalizes paid webhook', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Destructure object properties into local variables.
    const { stripeSessionId, reservation } = await checkoutToProcessing(agent);

    // Wait until the asynchronous operation resolves.
    await setHoldExpired(reservation.id);

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: 'evt_hold_expired_clear',
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

    // Create the response constant.
    const response = await postSignedWebhook(app, event);
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({ received: true });

    // Create the updated constant.
    const updated = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
  });

  // Define a single test case and its expectations.
  test('4b: expired hold with overlapping block marks manual_review', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Destructure object properties into local variables.
    const { stripeSessionId, reservation } = await checkoutToProcessing(agent);

    // Wait until the asynchronous operation resolves.
    await setHoldExpired(reservation.id);
    // Wait until the asynchronous operation resolves.
    await insertDateBlock(
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Continue the surrounding logic with this statement.
      new Date('2030-06-02T10:00:00.000Z'),
      // Continue the surrounding logic with this statement.
      new Date('2030-06-04T10:00:00.000Z')
    );

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: 'evt_hold_expired_overlap',
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

    // Create the response constant.
    const response = await postSignedWebhook(app, event);
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({ received: true });

    // Create the updated constant.
    const updated = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('manual_review');
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(0);
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
  });
});
