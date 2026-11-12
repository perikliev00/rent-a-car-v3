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
  insertTestAdmin,
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
  // Contribute this line to the enclosing declaration or statement.
  insertDateBlock,
// Continue the surrounding logic with this statement.
} = require('../helpers/dbFixtures');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('Concurrency integration: paidConflictManualReview', () => {
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
    // Store the awaited result in carId.
    carId = await insertIsolatedTestCar({ name: 'Paid Conflict Car' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carId);
  });

  // Define a single test case and its expectations.
  test('paid webhook after admin blocks dates marks manual_review', async () => {
    // Create the user agent constant.
    const userAgent = await createSessionAgent(app);
    // Create the checkout body constant.
    const checkoutBody = buildCheckoutBody(carId, { email: 'paid-conflict@example.com' });

    // Create the order res constant.
    const orderRes = await postOrder(userAgent, checkoutBody);
    // Assert that the value matches the intended expectation.
    expect(orderRes.status).toBe(200);
    // Create the checkout res constant.
    const checkoutRes = await postCheckout(userAgent, checkoutBody);
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
    // Assert that the value matches the intended expectation.
    expect(reservation.status).toBe('processing_payment');

    // Wait until the asynchronous operation resolves.
    await insertDateBlock(
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Continue the surrounding logic with this statement.
      new Date('2030-06-01T10:00:00.000Z'),
      // Continue the surrounding logic with this statement.
      new Date('2030-06-05T10:00:00.000Z')
    );

    // Create the blocks before webhook constant.
    const blocksBeforeWebhook = await getDateBlocksForCar(carId);
    // Assert that the value matches the intended expectation.
    expect(blocksBeforeWebhook).toHaveLength(1);

    // Create the event constant.
    const event = buildCheckoutCompletedEvent({
      // Provide the event id field value.
      eventId: 'evt_paid_conflict_manual_review',
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
    // Assert that the value matches the intended expectation.
    expect(await getDateBlocksForCar(carId)).toHaveLength(1);
    // Assert that the value matches the intended expectation.
    expect(await countProcessedStripeEvents('evt_paid_conflict_manual_review')).toBe(1);

    // Create the conflict order constant.
    const conflictOrder = await getDateBlocksForCar(carId);
    // Assert that the value matches the intended expectation.
    expect(conflictOrder[0].start_date).toBeTruthy();
  });
});
