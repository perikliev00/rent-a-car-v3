// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createSessionAgent,
  // Contribute this line to the enclosing declaration or statement.
  loginAsAdmin,
  // Contribute this line to the enclosing declaration or statement.
  postOrder,
  // Contribute this line to the enclosing declaration or statement.
  postCheckout,
  // Contribute this line to the enclosing declaration or statement.
  postAdminReservationStatus,
  // Contribute this line to the enclosing declaration or statement.
  postAdminReservationRefund,
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
  insertTestAdmin,
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
  getDateBlocksForCar,
  // Contribute this line to the enclosing declaration or statement.
  countOrdersForCar,
  // Contribute this line to the enclosing declaration or statement.
  insertDateBlock,
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
describeIf('MONEY-007: manualReviewResolution', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car id variable for later assignment.
  let carId;

  // Register setup that runs before the tests.
  beforeAll(async () => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
  });

  // Register setup that runs before the tests.
  beforeEach(async () => {
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
    // Store the awaited result in carId.
    carId = await insertIsolatedTestCar({ name: 'Manual Review Resolve Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define the async function forceManualReview.
  async function forceManualReview() {
    // Create the agent constant.
    const agent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId, { email: 'manual-review@example.com' });
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
    await insertDateBlock(
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Continue the surrounding logic with this statement.
      new Date('2030-06-01T10:00:00.000Z'),
      // Continue the surrounding logic with this statement.
      new Date('2030-06-05T10:00:00.000Z')
    );

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: `evt_manual_review_${reservation.id}_${Date.now()}`,
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

    // Assert that the value matches the intended expectation.
    expect((await postSignedWebhook(app, event)).status).toBe(200);

    // Create the updated constant.
    const updated = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(updated.status).toBe('manual_review');
    // Return the resulting value to the caller.
    return updated;
  }

  // Define a single test case and its expectations.
  test('admin confirm from manual_review creates order and date block', async () => {
    // Create the reservation constant.
    const reservation = await forceManualReview();
    // Clear the conflict block so confirm can addRange for the booking window.
    await require('../../helpers/dbTestHarness').pool.query(
      // Continue the surrounding logic with this statement.
      'DELETE FROM car_date_blocks WHERE car_id = $1',
      // Contribute this line to the enclosing declaration or statement.
      [carId]
    );

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationStatus(admin, reservation.id, {
      // Provide the status field value.
      status: 'confirmed',
      // Provide the reason field value.
      reason: 'admin_manual_review_confirm',
    });
    // Assert that the value matches the intended expectation.
    expect(res.status).toBe(200);

    // Create the confirmed constant.
    const confirmed = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(confirmed.status).toBe('confirmed');
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(1);
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
  });

  // Define a single test case and its expectations.
  test('admin refund from manual_review leaves booking without order', async () => {
    // Create the reservation constant.
    const reservation = await forceManualReview();
    // Assert that the value matches the intended expectation.
    expect(reservation.stripe_payment_intent_id || reservation.stripe_session_id).toBeTruthy();

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the res constant.
    const res = await postAdminReservationRefund(admin, reservation.id, {
      // Provide the reason field value.
      reason: 'admin_manual_review_refund',
    });
    // Assert that the value matches the intended expectation.
    expect({ status: res.status, body: res.body }).toMatchObject({ status: 200 });
    // Assert that the value matches the intended expectation.
    expect(res.body.data.status).toBe('succeeded');

    // Create the refunded constant.
    const refunded = await getReservationById(reservation.id);
    // Assert that the value matches the intended expectation.
    expect(refunded.status).toBe('refunded');
    // Assert that the value matches the intended expectation.
    expect(await getOrderByReservationId(reservation.id)).toBeFalsy();
    // Assert that the value matches the intended expectation.
    expect(await countOrdersForCar(carId)).toBe(0);
  });
});
