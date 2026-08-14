const { createIntegrationTestApp } = require('../helpers/integrationTestApp');
const { createTwoSessionAgents, postOrder } = require('../helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  cleanupTestCar,
  buildOrderBody,
  countActiveReservationsForCar,
  countOrdersForCar,
} = require('../helpers/dbFixtures');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('Concurrency integration: twoUsersSameDates', () => {
  let app;
  let carId;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Two Users Test Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('parallel POST /api/orders allows exactly one hold for the same car and dates', async () => {
    const [agentA, agentB] = await createTwoSessionAgents(app);
    const body = buildOrderBody(carId);

    const [resA, resB] = await Promise.all([
      postOrder(agentA, body),
      postOrder(agentB, body),
    ]);

    const statuses = [resA.status, resB.status].sort();
    expect(statuses).toEqual([200, 409]);

    const winner = resA.status === 200 ? resA : resB;
    const loser = resA.status === 409 ? resA : resB;

    expect(winner.body.success).toBe(true);
    expect(loser.body.success).toBe(false);
    expect(loser.body.error.code).toBe('CONFLICT');

    expect(await countActiveReservationsForCar(carId)).toBe(1);
    expect(await countOrdersForCar(carId)).toBe(0);
  });
});
