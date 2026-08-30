const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createTwoSessionAgents,
  postOrder,
  postCheckout,
} = require('../helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  buildCheckoutBody,
  getActiveReservationForCar,
  getReservationByStripeSessionId,
} = require('../helpers/dbFixtures');
const { pool } = require('../../helpers/dbTestHarness');
const { ADVISORY_LOCK_NS } = require('../../../src/db/transaction');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

async function countUngrantedCheckoutLockWaiters(reservationId) {
  const result = await pool.query(
    `
    SELECT 1
    FROM pg_locks
    WHERE locktype = 'advisory'
      AND granted = false
      AND classid = $1
      AND objid = $2
      AND objsubid = 2
    `,
    [ADVISORY_LOCK_NS.CHECKOUT, Number(reservationId)]
  );
  return result.rowCount;
}

describeIf('checkout lock pool starvation', () => {
  let app;
  let carAId;
  let carBId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carAId = await insertIsolatedTestCar({ name: 'Checkout Lock Pool Car A' });
    carBId = await insertIsolatedTestCar({ name: 'Checkout Lock Pool Car B' });
  });

  afterEach(async () => {
    stripeTestStub.releaseCreateSessionGate();
    await cleanupTestCar(carAId);
    await cleanupTestCar(carBId);
    stripeTestStub.clearSessions();
  });

  test(
    'pool-sized concurrent checkouts for one reservation complete without blocking another reservation',
    async () => {
      const [agentA, agentB] = await createTwoSessionAgents(app);
      const bodyA = buildCheckoutBody(carAId, {
        email: 'checkout-lock-pool-a@example.com',
      });
      const bodyB = buildCheckoutBody(carBId, {
        email: 'checkout-lock-pool-b@example.com',
      });

      expect((await postOrder(agentA, bodyA)).status).toBe(200);
      expect((await postOrder(agentB, bodyB)).status).toBe(200);

      const reservationA = await getActiveReservationForCar(carAId);
      expect(reservationA).toBeTruthy();

      const concurrency = Math.max(Number(pool.options.max) || 5, 5);
      stripeTestStub.armCreateSessionGate();

      const aCheckouts = Array.from({ length: concurrency }, () => postCheckout(agentA, bodyA));

      try {
        await stripeTestStub.waitForCreateSession();
        await new Promise((resolve) => setTimeout(resolve, 150));

        expect(await countUngrantedCheckoutLockWaiters(reservationA.id)).toBe(0);

        const otherCheckout = await postCheckout(agentB, bodyB);
        expect(otherCheckout.status).toBe(200);
        const otherSessionId = extractStripeSessionId(otherCheckout);
        expect(otherSessionId).toBeTruthy();

        stripeTestStub.releaseCreateSessionGate();

        const aResults = await Promise.all(aCheckouts);
        for (const result of aResults) {
          expect(result.status).toBe(200);
        }

        const aSessionIds = aResults.map(extractStripeSessionId);
        expect(new Set(aSessionIds).size).toBe(1);
        expect(aSessionIds[0]).not.toBe(otherSessionId);
        expect(stripeTestStub.sessions.size).toBe(2);

        const linked = await getReservationByStripeSessionId(aSessionIds[0]);
        expect(linked.status).toBe('processing_payment');
        expect(linked.stripe_session_id).toBe(aSessionIds[0]);
      } finally {
        stripeTestStub.releaseCreateSessionGate();
      }
    },
    15000
  );
});
