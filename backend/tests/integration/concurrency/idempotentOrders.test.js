const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const { createSessionAgent, postOrder } = require('../helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  buildOrderBody,
  countActiveReservationsForCar,
} = require('../helpers/dbFixtures');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Concurrency integration: idempotentOrders', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Idempotent Orders Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('same session and same dates returns success without creating a second hold', async () => {
    const agent = await createSessionAgent(app);
    const body = buildOrderBody(carId);

    const first = await postOrder(agent, body);
    const second = await postOrder(agent, body);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.success).toBe(true);
    expect(second.body.success).toBe(true);
    expect(await countActiveReservationsForCar(carId)).toBe(1);
  });

  test('same session with different dates returns conflict', async () => {
    const agent = await createSessionAgent(app);

    const first = await postOrder(agent, buildOrderBody(carId));
    expect(first.status).toBe(200);

    const second = await postOrder(
      agent,
      buildOrderBody(carId, {
        pickupDate: '2030-07-01',
        returnDate: '2030-07-05',
      })
    );

    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('CONFLICT');
    expect(await countActiveReservationsForCar(carId)).toBe(1);
  });
});
