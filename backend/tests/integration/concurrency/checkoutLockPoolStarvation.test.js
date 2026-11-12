// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  createTwoSessionAgents,
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
  getReservationByStripeSessionId,
// Continue the surrounding logic with this statement.
} = require('../helpers/dbFixtures');
// Destructure object properties into local variables.
const { pool } = require('../../helpers/dbTestHarness');
// Destructure object properties into local variables.
const { ADVISORY_LOCK_NS } = require('../../../src/db/transaction');
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

// Define the async function countUngrantedCheckoutLockWaiters.
async function countUngrantedCheckoutLockWaiters(reservationId) {
  // Create the result constant.
  const result = await pool.query(
    // Continue the surrounding logic with this statement.
    `
    SELECT 1
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND granted = false
      AND classid = $1
      AND objid = $2
      AND objsubid = 2
    `,
    // Continue the surrounding logic with this statement.
    [ADVISORY_LOCK_NS.CHECKOUT, Number(reservationId)]
  );
  // Return the resulting value to the caller.
  return result.rowCount;
}

// Call describeIf to perform this step.
describeIf('checkout lock pool starvation', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Reserve the car aid variable for later assignment.
  let carAId;
  // Reserve the car bid variable for later assignment.
  let carBId;

  // Register setup that runs before the tests.
  beforeAll(() => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
  });

  // Register setup that runs before the tests.
  beforeEach(async () => {
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
    // Store the awaited result in carAId.
    carAId = await insertIsolatedTestCar({ name: 'Checkout Lock Pool Car A' });
    // Store the awaited result in carBId.
    carBId = await insertIsolatedTestCar({ name: 'Checkout Lock Pool Car B' });
  });

  // Register cleanup that runs after the tests.
  afterEach(async () => {
    // Call stripeTestStub.releaseCreateSessionGate to perform this step.
    stripeTestStub.releaseCreateSessionGate();
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carAId);
    // Wait until the asynchronous operation resolves.
    await cleanupTestCar(carBId);
    // Call stripeTestStub.clearSessions to perform this step.
    stripeTestStub.clearSessions();
  });

  // Define a single test case and its expectations.
  test(
    // Supply the literal value used by the enclosing expression.
    'pool-sized concurrent checkouts for one reservation complete without blocking another reservation',
    // Call async to perform this step.
    async () => {
      // Destructure array values into local variables.
      const [agentA, agentB] = await createTwoSessionAgents(app);
      // Create the body a constant.
      const bodyA = buildCheckoutBody(carAId, {
        // Provide the email field value.
        email: 'checkout-lock-pool-a@example.com',
      });
      // Create the body b constant.
      const bodyB = buildCheckoutBody(carBId, {
        // Provide the email field value.
        email: 'checkout-lock-pool-b@example.com',
      });

      // Assert that the value matches the intended expectation.
      expect((await postOrder(agentA, bodyA)).status).toBe(200);
      // Assert that the value matches the intended expectation.
      expect((await postOrder(agentB, bodyB)).status).toBe(200);

      // Create the reservation a constant.
      const reservationA = await getActiveReservationForCar(carAId);
      // Assert that the value matches the intended expectation.
      expect(reservationA).toBeTruthy();

      // Create the concurrency constant.
      const concurrency = Math.max(Number(pool.options.max) || 5, 5);
      // Call stripeTestStub.armCreateSessionGate to perform this step.
      stripeTestStub.armCreateSessionGate();

      // Create the a checkouts constant.
      const aCheckouts = Array.from({ length: concurrency }, () => postCheckout(agentA, bodyA));

      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await stripeTestStub.waitForCreateSession();
        // Wait until the asynchronous operation resolves.
        await new Promise((resolve) => setTimeout(resolve, 150));

        // Assert that the value matches the intended expectation.
        expect(await countUngrantedCheckoutLockWaiters(reservationA.id)).toBe(0);

        // Create the other checkout constant.
        const otherCheckout = await postCheckout(agentB, bodyB);
        // Assert that the value matches the intended expectation.
        expect(otherCheckout.status).toBe(200);
        // Create the other session id constant.
        const otherSessionId = extractStripeSessionId(otherCheckout);
        // Assert that the value matches the intended expectation.
        expect(otherSessionId).toBeTruthy();

        // Call stripeTestStub.releaseCreateSessionGate to perform this step.
        stripeTestStub.releaseCreateSessionGate();

        // Create the a results constant.
        const aResults = await Promise.all(aCheckouts);
        // Iterate using the loop initializer, condition, and step.
        for (const result of aResults) {
          // Assert that the value matches the intended expectation.
          expect(result.status).toBe(200);
        }

        // Create the a session ids constant.
        const aSessionIds = aResults.map(extractStripeSessionId);
        // Assert that the value matches the intended expectation.
        expect(new Set(aSessionIds).size).toBe(1);
        // Assert that the value matches the intended expectation.
        expect(aSessionIds[0]).not.toBe(otherSessionId);
        // Assert that the value matches the intended expectation.
        expect(stripeTestStub.sessions.size).toBe(2);

        // Create the linked constant.
        const linked = await getReservationByStripeSessionId(aSessionIds[0]);
        // Assert that the value matches the intended expectation.
        expect(linked.status).toBe('processing_payment');
        // Assert that the value matches the intended expectation.
        expect(linked.stripe_session_id).toBe(aSessionIds[0]);
      // Contribute this line to the enclosing declaration or statement.
      } finally {
        // Call stripeTestStub.releaseCreateSessionGate to perform this step.
        stripeTestStub.releaseCreateSessionGate();
      }
    },
    // Supply the literal value used by the enclosing expression.
    15000
  );
});
