const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createSessionAgent,
  loginAsAdmin,
  postOrder,
  withCsrf,
} = require('../helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  cleanupTestCar,
  buildOrderBody,
  buildAdminOrderBody,
  countActiveReservationsForCar,
  getDateBlocksForCar,
  countOrdersForCar,
} = require('../helpers/dbFixtures');
const { RESERVATION_CONFLICT_MESSAGE } = require('../../../src/services/admin/order/orderConflictService');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Concurrency integration: adminVsUserHold', () => {
  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Admin Vs User Hold Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('blocks admin order creation while user has an active online hold', async () => {
    const userAgent = await createSessionAgent(app);
    const userHold = await postOrder(userAgent, buildOrderBody(carId));
    expect(userHold.status).toBe(200);

    const adminAgent = await loginAsAdmin(app);
    const adminCreate = await withCsrf(adminAgent, adminAgent.post('/api/admin/orders')).send(
      buildAdminOrderBody(carId)
    );

    expect(adminCreate.status).toBe(422);
    expect(adminCreate.body.success).toBe(false);
    expect(adminCreate.body.error.code).toBe('VALIDATION_ERROR');
    expect(adminCreate.body.error.message).toMatch(/active online reservation/i);
    expect(adminCreate.body.error.message).toBe(RESERVATION_CONFLICT_MESSAGE);

    expect(await countActiveReservationsForCar(carId)).toBe(1);
    expect(await countOrdersForCar(carId)).toBe(0);
    expect(await getDateBlocksForCar(carId)).toHaveLength(0);
  });
});
