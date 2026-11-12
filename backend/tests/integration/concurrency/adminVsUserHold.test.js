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
const { waitUntilAdvisoryLockWaiter, ADVISORY_LOCK_NS } = require('../helpers/lockBarrier');
const { pool } = require('../../helpers/dbTestHarness');
const { acquireCarAdvisoryLock } = require('../../../src/db/transaction');
const reservationSql = require('../../../src/services/sql/reservationSqlService');
const { parseSofiaDate } = require('../../../src/utils/date/timezone');
const { RESERVATION_CONFLICT_MESSAGE } = require('../../../src/services/admin/order/orderConflictService');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Concurrency integration: adminVsUserHold', () => {
  jest.setTimeout(60_000);

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

  test('admin create waits on car lock then loses to an overlapping hold', async () => {
    const adminAgent = await loginAsAdmin(app);
    const competitor = await pool.connect();
    const holdPricing = { rentalDays: 4, totalPrice: 200, deliveryPrice: 0, returnPrice: 0 };
    try {
      await competitor.query('BEGIN');
      await acquireCarAdvisoryLock(competitor, carId);

      const adminPromise = Promise.resolve(
        withCsrf(adminAgent, adminAgent.post('/api/admin/orders')).send(buildAdminOrderBody(carId))
      );

      await waitUntilAdvisoryLockWaiter(ADVISORY_LOCK_NS.CAR, carId);

      await reservationSql.createPendingReservation(
        {
          carId,
          sessionId: `hold-race-${carId}`,
          startDate: parseSofiaDate('2030-06-01', '10:00'),
          endDate: parseSofiaDate('2030-06-05', '10:00'),
          pickupTime: '10:00',
          returnTime: '10:00',
          pickupLocation: 'office',
          returnLocation: 'office',
          pricing: holdPricing,
        },
        competitor
      );
      await competitor.query('COMMIT');

      const adminCreate = await adminPromise;
      expect(adminCreate.status).toBe(422);
      expect(adminCreate.body.success).toBe(false);
      expect(adminCreate.body.error.message).toBe(RESERVATION_CONFLICT_MESSAGE);

      expect(await countActiveReservationsForCar(carId)).toBe(1);
      expect(await countOrdersForCar(carId)).toBe(0);
      expect(await getDateBlocksForCar(carId)).toHaveLength(0);
    } finally {
      try {
        await competitor.query('ROLLBACK');
      } catch {
        // already committed
      }
      competitor.release();
    }
  });
});
