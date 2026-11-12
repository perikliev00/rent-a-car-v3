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
  // Contribute this line to the enclosing declaration or statement.
  getReservationById,
  // Contribute this line to the enclosing declaration or statement.
  getOrderByReservationId,
  // Contribute this line to the enclosing declaration or statement.
  setHoldExpired,
  // Contribute this line to the enclosing declaration or statement.
  countOrdersForCar,
// Continue the surrounding logic with this statement.
} = require('../helpers/dbFixtures');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  reconcileProcessingStripeReservations,
// Continue the surrounding logic with this statement.
} = require('../../../src/services/reservationService');
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
describeIf('MONEY-009: processingCleanupMatrix', () => {
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
    carId = await insertIsolatedTestCar({ name: 'Processing Cleanup Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define the async function checkoutToExpiredHold.
  async function checkoutToExpiredHold() {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId, {
      // Provide the email field value.
      email: `cleanup-${Date.now()}@example.com`,
    });
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
    // Wait until the asynchronous operation resolves.
    await setHoldExpired(reservation.id);
    // Return the resulting value to the caller.
    return { stripeSessionId, reservation };
  }

  // Define a single test case and its expectations.
  test('open unpaid Stripe session keeps processing after cleanup', async () => {
    // Destructure object properties into local variables.
    const { stripeSessionId, reservation } = await checkoutToExpiredHold();
    // Call stripeTestStub.markUnpaidOpen to perform this step.
    stripeTestStub.markUnpaidOpen(stripeSessionId);

    // Create the result constant.
    const result = await reconcileProcessingStripeReservations(new Date());
    // Assert that the value matches the intended expectation.
    expect(result.kept).toBeGreaterThanOrEqual(1);

    // Create the updated constant.
    const updated = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('processing_payment');
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
  });

  // Define a single test case and its expectations.
  test('paid Stripe session finalizes during cleanup', async () => {
    // Destructure object properties into local variables.
    const { stripeSessionId, reservation } = await checkoutToExpiredHold();
    // Call stripeTestStub.markPaid to perform this step.
    stripeTestStub.markPaid(stripeSessionId, {
      // Provide the amount total field value.
      amount_total: Math.round(Number(reservation.total_price) * 100),
      // Provide the currency field value.
      currency: 'eur',
    });

    // Create the result constant.
    const result = await reconcileProcessingStripeReservations(new Date());
    // Assert that the value matches the intended expectation.
    expect(result.finalized).toBeGreaterThanOrEqual(1);

    // Create the updated constant.
    const updated = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(1);
  });

  // Define a single test case and its expectations.
  test('expired unpaid Stripe session marks reservation expired', async () => {
    // Destructure object properties into local variables.
    const { stripeSessionId, reservation } = await checkoutToExpiredHold();
    // Call stripeTestStub.expireSession to perform this step.
    stripeTestStub.expireSession(stripeSessionId);

    // Create the result constant.
    const result = await reconcileProcessingStripeReservations(new Date());
    // Assert that the value matches the intended expectation.
    expect(result.expired).toBeGreaterThanOrEqual(1);

    // Create the updated constant.
    const updated = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('expired');
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeNull();
  });
});
