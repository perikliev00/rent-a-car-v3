const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { createSessionAgent, loginAsAdmin, withCsrf } = require('./helpers/sessionAgentFactory');
const {
  insertIsolatedTestCar,
  insertTestAdmin,
  insertLinkedBooking,
  cleanupReservationsForCar,
  cleanupTestCar,
} = require('./helpers/dbFixtures');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('ADMIN-013: adminDeleteBookedCar', () => {
  let app;
  let carId;
  const carName = `Delete Booked Car ${Date.now()}`;

  beforeAll(async () => {
    app = createIntegrationTestApp();
    await insertTestAdmin();
  });

  beforeEach(async () => {
    carId = await insertIsolatedTestCar({ name: carName });
  });

  afterEach(async () => {
    await cleanupTestCar(carId);
  });

  test('DELETE returns 409 while confirmed booking exists; succeeds after cleanup', async () => {
    await insertLinkedBooking({
      carId,
      status: 'confirmed',
      pickupDate: '2031-04-01',
      returnDate: '2031-04-04',
      guest: { email: `booked-car-${Date.now()}@example.com`, fullName: 'Booked Car Guest' },
    });

    const admin = await loginAsAdmin(app);
    const blocked = await withCsrf(admin, admin.delete(`/api/admin/cars/${carId}`));
    expect(blocked.status).toBe(409);
    expect(blocked.body?.error?.code || blocked.body?.code).toBe('CONFLICT');

    const publicAgent = await createSessionAgent(app);
    const stillListed = await publicAgent.get('/api/cars');
    const stillCars = stillListed.body?.data?.cars ?? stillListed.body?.cars ?? [];
    expect(stillCars.some((c) => Number(c.id) === carId || c.name === carName)).toBe(true);

    await cleanupReservationsForCar(carId);

    const allowed = await withCsrf(admin, admin.delete(`/api/admin/cars/${carId}`));
    expect(allowed.status).toBe(200);

    const afterDelete = await publicAgent.get('/api/cars');
    const afterCars = afterDelete.body?.data?.cars ?? afterDelete.body?.cars ?? [];
    expect(afterCars.some((c) => Number(c.id) === carId || c.name === carName)).toBe(false);

    carId = null;
  });
});
