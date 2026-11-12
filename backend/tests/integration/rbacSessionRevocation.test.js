const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { loginAsStaff, loginAsAdmin, putUserRoles } = require('./helpers/sessionAgentFactory');
const {
  insertTestAdmin,
  insertTestStaff,
  cleanupTestStaff,
} = require('./helpers/dbFixtures');
const { pool } = require('../helpers/dbTestHarness');

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

  test('stale users.role=staff cannot restore access after RBAC removal', async () => {
    const again = await insertTestStaff({
      roleSlug: 'receptionist',
      email: staff.email,
      password: staff.password,
    });
    staff = again;

    const admin = await loginAsAdmin(app);
    const cleared = await putUserRoles(admin, staff.userId, []);
    expect(cleared.status).toBeLessThan(400);

    // Force stale legacy column (simulates pre-cleanup DB / missed demote)
    await pool.query(`UPDATE users SET role = 'staff', updated_at = NOW() WHERE id = $1`, [
      staff.userId,
    ]);

    const roleRow = await pool.query(`SELECT role FROM users WHERE id = $1`, [staff.userId]);
    expect(roleRow.rows[0].role).toBe('staff');

    const ur = await pool.query(`SELECT 1 FROM user_roles WHERE user_id = $1`, [staff.userId]);
    expect(ur.rowCount).toBe(0);

    const reLogin = await loginAsStaff(app, staff);
    const probe = await reLogin.get('/api/admin/reservations/ops-dashboard');
    expect([401, 403]).toContain(probe.status);
    expect(probe.status).not.toBe(200);
  });
});
