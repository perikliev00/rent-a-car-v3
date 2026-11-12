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
  buildCheckoutCompletedEvent,
  // Contribute this line to the enclosing declaration or statement.
  buildStripeEvent,
  // Contribute this line to the enclosing declaration or statement.
  postSignedWebhook,
  // Contribute this line to the enclosing declaration or statement.
  postUnsignedWebhook,
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
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getOrderByReservationId,
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

// Define the extractStripeSessionId function.
function extractStripeSessionId(checkoutRes) {
  // Return the resulting value to the caller.
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

// Call describeIf to perform this step.
describeIf('MONEY-011: invalidWebhookNoSideEffects', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Invalid Webhook Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define the async function checkoutToProcessing.
  async function checkoutToProcessing() {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId, { email: 'invalid-webhook@example.com' });
    // Assert that the value matches the intended expectation.
    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    // Create the checkout res constant.
    const checkoutRes = await postCheckout(agent, checkoutBody);
    // Assert that the value matches the intended expectation.
    expect(checkoutRes.status).toBe(200);
    // Create the stripe session id constant.
    const stripeSessionId = extractStripeSessionId(checkoutRes);
    // Create the reservation constant.
    const reservation = await getReservationByStripeSessionId(stripeSessionId);
    // Return the resulting value to the caller.
    return { stripeSessionId, reservation };
  }

  // Define a single test case and its expectations.
  test('invalid signature returns 400 and leaves reservation untouched', async () => {
    // Destructure object properties into local variables.
    const { stripeSessionId, reservation } = await checkoutToProcessing();

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: 'evt_invalid_sig',
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
    const response = await postUnsignedWebhook(app, event);
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(400);

    // Create the updated constant.
    const updated = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    // Assert that the value matches the intended expectation.
    expect(await countProcessedStripeEvents('evt_invalid_sig')).toBe(0);
  });

  // Define a single test case and its expectations.
  test('unpaid checkout.session.completed does not finalize', async () => {
    // Destructure object properties into local variables.
    const { stripeSessionId, reservation } = await checkoutToProcessing();

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: 'evt_unpaid_completed',
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
      // Provide the payment status field value.
      paymentStatus: 'unpaid',
    });

    // Create the response constant.
    const response = await postSignedWebhook(app, event);
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);

    // Create the updated constant.
    const updated = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(0);
  });

  // Define a single test case and its expectations.
  test('unknown event type has no booking side effects', async () => {
    // Destructure object properties into local variables.
    const { stripeSessionId, reservation } = await checkoutToProcessing();

    // Create the event constant.
    const event = buildStripeEvent({
      // Provide the event id field value.
      eventId: 'evt_unknown_type',
      // Provide the type field value.
      type: 'payment_intent.succeeded',
      // Provide the object field value.
      object: {
        // Provide the id field value.
        id: 'pi_unknown',
        // Provide the metadata field value.
        metadata: {
          // Provide the reservation id field value.
          reservationId: String(reservation.id),
          // Provide the session id field value.
          sessionId: reservation.session_id,
        },
      },
    });

    // Create the response constant.
    const response = await postSignedWebhook(app, event);
    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);

    // Create the updated constant.
    const updated = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(updated.stripe_session_id).toBe(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
    // Assert that the value matches the intended expectation.
    expect(await countProcessedStripeEvents('evt_unknown_type')).toBe(0);
  });
});
