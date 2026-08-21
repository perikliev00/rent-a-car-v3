const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { loginAsAdmin, postAdminReservationStatus } = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertLinkedBooking,
  getReservationById,
  getStatusHistory,
  getDateBlocksForCar,
  cleanupTestCar,
} = require('./helpers/dbFixtures');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('ADMIN-005: adminInvalidTransition', () => {
  let app;
  let carId;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: 'Invalid Transition Car' });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('illegal confirmed→completed is rejected without history or block changes', async () => {
    const seeded = await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2031-05-01',
      returnDate: '2031-05-04',
      guest: { email: `invalid-tx-${Date.now()}@example.com` },
    });
    const blocksBefore = (await getDateBlocksForCar(carId)).length;
    const historyBefore = await getStatusHistory(seeded.reservationId);

    const admin = await loginAsAdmin(app);
    const result = await postAdminReservationStatus(admin, seeded.reservationId, {
      status: 'completed',
    });
    expect(result.status >= 400).toBe(true);

    const still = await getReservationById(seeded.reservationId);
    expect(still.status).toBe('confirmed');

    const historyAfter = await getStatusHistory(seeded.reservationId);
    expect(historyAfter.length).toBe(historyBefore.length);
    expect(historyAfter.some((h) => h.new_status === 'completed')).toBe(false);
    expect((await getDateBlocksForCar(carId)).length).toBe(blocksBefore);
  });
});
