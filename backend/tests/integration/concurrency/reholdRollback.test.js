const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const {
  createTwoSessionAgents,
  postOrder,
  postReleaseAndRehold,
} = require('../helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  buildOrderBody,
  countActiveReservationsForCar,
} = require('../helpers/dbFixtures');
const { pool } = require('../../helpers/dbTestHarness');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('MONEY-001: reholdRollback', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Rehold Rollback Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('failed release-and-rehold keeps the original hold', async () => {
    const [agentA, agentB] = await createTwoSessionAgents(app);
    const bodyA = buildOrderBody(carId, {
      pickupDate: '2030-07-01',
      returnDate: '2030-07-05',
    });
    const bodyB = buildOrderBody(carId, {
      pickupDate: '2030-07-10',
      returnDate: '2030-07-14',
    });

    expect((await postOrder(agentA, bodyA)).status).toBe(200);
    expect((await postOrder(agentB, bodyB)).status).toBe(200);
    expect(await countActiveReservationsForCar(carId)).toBe(2);

    const reholdRes = await postReleaseAndRehold(agentA, {
      ...bodyB,
      pickupTime: '10:00',
      returnTime: '10:00',
    });
    expect(reholdRes.status).toBe(409);
    expect(reholdRes.body.error.code).toBe('CONFLICT');

    expect(await countActiveReservationsForCar(carId)).toBe(2);

    const holds = await pool.query(
      `
      SELECT pickup_date, return_date, status
      FROM reservations
      WHERE car_id = $1
        AND status IN ('pending_payment', 'processing_payment')
        AND hold_expires_at > NOW()
      ORDER BY pickup_date
      `,
      [carId]
    );

    expect(holds.rows).toHaveLength(2);
    expect(new Date(holds.rows[0].pickup_date).toISOString().startsWith('2030-07-01')).toBe(true);
    expect(new Date(holds.rows[1].pickup_date).toISOString().startsWith('2030-07-10')).toBe(true);
  });
});
