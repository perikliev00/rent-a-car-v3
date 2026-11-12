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
  countOrdersForCar,
  // Contribute this line to the enclosing declaration or statement.
  countProcessedStripeEvents,
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
describeIf('Concurrency integration: successWebhookRace', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Success Webhook Race Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define the async function startCheckout.
  async function startCheckout() {
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

    // H-06 stub keeps sessions unpaid until explicitly marked paid.
    stripeTestStub.markPaid(stripeSessionId, {
      // Provide the amount total field value.
      amount_total: Math.round(Number(reservation.total_price) * 100),
      // Provide the currency field value.
      currency: 'eur',
    });

    // Return the resulting value to the caller.
    return { agent, stripeSessionId, reservation };
  }

  // Define a single test case and its expectations.
  test('parallel success page and webhook finalize exactly once', async () => {
    // Destructure object properties into local variables.
    const { agent, stripeSessionId, reservation } = await startCheckout();

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: `evt_success_race_${Date.now()}`,
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

    // Destructure array values into local variables.
    const [successRes, webhookRes] = await Promise.all([
      // Call agent.get to perform this step.
      agent.get(`/api/checkout/success?session_id=${stripeSessionId}`),
      // Call postSignedWebhook to perform this step.
      postSignedWebhook(app, event),
    ]);

    // Either entry point may win the race; HTTP can briefly fail for the loser,
    // but the booking must end confirmed exactly once.
    const successConfirmed =
      // Update successRes.status with the right-hand side value.
      successRes.status === 200 && successRes.body?.data?.confirmed === true;
    // Create the webhook accepted constant.
    const webhookAccepted = webhookRes.status === 200;
    // Assert that the value matches the intended expectation.
    expect(successConfirmed || webhookAccepted).toBe(true);

    // Create the updated constant.
    const updated = await getReservationByStripeSessionId(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(await countProcessedStripeEvents(event.id)).toBe(1);

    // Create the success after constant.
    const successAfter = await agent.get(
      // Continue the surrounding logic with this statement.
      `/api/checkout/success?session_id=${stripeSessionId}`
    );
    // Assert that the value matches the intended expectation.
    expect(successAfter.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(successAfter.body.data.confirmed).toBe(true);
  });

  // Define a single test case and its expectations.
  test('webhook before success remains idempotent on success page', async () => {
    // Destructure object properties into local variables.
    const { agent, stripeSessionId, reservation } = await startCheckout();

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: `evt_webhook_first_${Date.now()}`,
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

    // Create the webhook res constant.
    const webhookRes = await postSignedWebhook(app, event);
    // Assert that the value matches the intended expectation.
    expect(webhookRes.status).toBe(200);

    // Create the success res constant.
    const successRes = await agent.get(`/api/checkout/success?session_id=${stripeSessionId}`);
    // Assert that the value matches the intended expectation.
    expect(successRes.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(successRes.body.data.confirmed).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(successRes.body.data.title).toBe('Booking Confirmed');

    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
  });

  // Define a single test case and its expectations.
  test('success before webhook finalizes, then webhook is idempotent', async () => {
    // Destructure object properties into local variables.
    const { agent, stripeSessionId, reservation } = await startCheckout();

    // Create the success res constant.
    const successRes = await agent.get(`/api/checkout/success?session_id=${stripeSessionId}`);
    // Assert that the value matches the intended expectation.
    expect(successRes.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(successRes.body.data.confirmed).toBe(true);

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: `evt_success_first_${Date.now()}`,
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

    // Create the webhook res constant.
    const webhookRes = await postSignedWebhook(app, event);
    // Assert that the value matches the intended expectation.
    expect(webhookRes.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(webhookRes.body).toEqual({ received: true });

    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect((await getReservationByStripeSessionId(stripeSessionId)).status).toBe('confirmed');
  });
});
