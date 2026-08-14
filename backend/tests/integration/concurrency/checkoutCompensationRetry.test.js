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
  getActiveReservationForCar,
  getReservationById,
  countActiveReservationsForCar,
} = require('../helpers/dbFixtures');
const stripeTestStub = require('../../../src/services/payment/stripeTestStub');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('MONEY-008: checkoutCompensationRetry', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    stripeTestStub.clearSessions();
    carId = await insertIsolatedTestCar({ name: 'Checkout Compensation Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
    stripeTestStub.clearSessions();
  });

  test('create failure after existing hold keeps hold and allows retry', async () => {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, { email: 'checkout-comp@example.com' });

    expect((await postOrder(agent, checkoutBody)).status).toBe(200);
    const hold = await getActiveReservationForCar(carId);
    expect(hold).toBeTruthy();
    expect(hold.status).toBe('pending_payment');

    stripeTestStub.failNextCreateSession();
    const failedCheckout = await postCheckout(agent, checkoutBody);
    expect(failedCheckout.status).toBe(422);
    expect(failedCheckout.body.error.code).toBe('CHECKOUT_ERROR');

    const afterFail = await getReservationById(hold.id);
    expect(afterFail.status).toBe('pending_payment');
    expect(await countActiveReservationsForCar(carId)).toBe(1);

    const retry = await postCheckout(agent, checkoutBody);
    expect(retry.status).toBe(200);
    expect(retry.body.data.checkoutUrl).toContain('session_id=');

    const processing = await getReservationById(hold.id);
    expect(processing.status).toBe('processing_payment');
    expect(processing.stripe_session_id).toBeTruthy();
  });

  test('create failure when hold created this step cancels the new hold', async () => {
    const agent = await createSessionAgent(app);
    const checkoutBody = buildCheckoutBody(carId, {
      email: 'checkout-new-hold@example.com',
      pickupDate: '2030-08-01',
      returnDate: '2030-08-05',
    });

    stripeTestStub.failNextCreateSession();
    const failedCheckout = await postCheckout(agent, checkoutBody);
    expect(failedCheckout.status).toBe(422);
    expect(failedCheckout.body.error.code).toBe('CHECKOUT_ERROR');

    expect(await countActiveReservationsForCar(carId)).toBe(0);
  });
});
