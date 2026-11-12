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
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getOrderByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  clearStripeSessionId,
  // Contribute this line to the enclosing declaration or statement.
  countOrdersForCar,
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
describeIf('MONEY-013: orphanPaidSessionRecovery', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Orphan Recovery Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define a single test case and its expectations.
  test('paid webhook recovers when reservation has no linked stripe session id', async () => {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId, { email: 'orphan-recovery@example.com' });

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
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('processing_payment');

    // Simulate link loss / orphan: paid Stripe session exists, reservation link cleared.
    await clearStripeSessionId(reservation.id);
    // Create the unlinked constant.
    const unlinked = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(unlinked.stripe_session_id).toBeNull();

    // Call stripeTestStub.markPaid to perform this step.
    stripeTestStub.markPaid(stripeSessionId, {
      // Provide the amount total field value.
      amount_total: Math.round(Number(reservation.total_price) * 100),
      // Provide the currency field value.
      currency: 'eur',
    });

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: 'evt_orphan_paid_recovery',
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

    // Create the recovered constant.
    const recovered = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(recovered.status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect(recovered.stripe_session_id).toBe(stripeSessionId);
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(1);
  });
});
