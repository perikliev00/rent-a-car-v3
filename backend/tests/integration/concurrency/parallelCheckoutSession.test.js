const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  postOrder,
  postCheckout,
} = require('../helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  buildCheckoutBody,
  getReservationByStripeSessionId,
} = require('../helpers/dbFixtures');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function extractStripeSessionId(checkoutRes) {
  return checkoutRes.body.data.checkoutUrl.split('session_id=').pop()?.split('&')[0];
}

describeIf('parallel checkout create-and-link', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Parallel Checkout Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  test('two concurrent checkouts for the same reservation create one payable Stripe session', async () => {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, {
      email: 'parallel-checkout@example.com',
    });

    expect((await postOrder(agent, checkoutBody)).status).toBe(200);

    const [first, second] = await Promise.all([
      postCheckout(agent, checkoutBody),
      postCheckout(agent, checkoutBody),
    ]);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const firstSessionId = extractStripeSessionId(first);
    const secondSessionId = extractStripeSessionId(second);
    expect(firstSessionId).toBe(secondSessionId);
    expect(stripeTestStub.sessions.size).toBe(1);

    const reservation = await getReservationByStripeSessionId(firstSessionId);
    expect(reservation.status).toBe('processing_payment');
    expect(reservation.stripe_session_id).toBe(firstSessionId);
  });
});
