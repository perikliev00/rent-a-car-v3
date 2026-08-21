const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { loginAsStaff, loginAsAdmin, putUserRoles } = require('./helpers/sessionAgentFactory');
const {
  insertTestAdmin,
  insertTestStaff,
  cleanupTestStaff,
} = require('./helpers/dbFixtures');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('AUTH-002: rbacSessionRevocation', () => {
  jest.setTimeout(60_000);

  let app;
  let staff;

  beforeAll(async () => {
    app = createIntegrationTestApp({ usePgSessionStore: true });
    await insertTestAdmin();
    staff = await insertTestStaff({ roleSlug: 'receptionist' });
  });

  afterAll(async () => {
    if (staff?.email) await cleanupTestStaff(staff.email).catch(() => undefined);
  });

  test('clearing staff roles destroys session; next API is unauthorized', async () => {
    const session = await loginAsStaff(app, staff);

    const before = await session.get('/api/admin/reservations/ops-dashboard');
    expect(before.status).toBe(200);

    const admin = await loginAsAdmin(app);
    const cleared = await putUserRoles(admin, staff.userId, []);
    expect(cleared.status).toBeLessThan(400);

    const after = await session.get('/api/admin/reservations/ops-dashboard');
    expect([401, 403]).toContain(after.status);
  });
});
