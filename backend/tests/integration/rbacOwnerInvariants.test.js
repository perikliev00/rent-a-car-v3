const { pool } = require('../helpers/dbTestHarness');
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const {
  loginAsAdmin,
  putUserRoles,
  updateRolePermissions,
} = require('./helpers/sessionAgentFactory');
const {
  DEFAULT_ADMIN,
  insertTestAdmin,
  insertTestStaff,
  cleanupTestStaff,
  getRoleBySlug,
} = require('./helpers/dbFixtures');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('AUTH-005: rbacOwnerInvariants', () => {
  jest.setTimeout(60_000);
  let app;
  let secondOwnerEmail = null;

  beforeAll(async () => {
    app = createIntegrationTestApp();
  });

  afterAll(async () => {
    if (secondOwnerEmail) await cleanupTestStaff(secondOwnerEmail).catch(() => undefined);
    await insertTestAdmin();
  });

  test('cannot remove last owner or edit owner permissions', async () => {
    await insertTestAdmin();
    const ownerRole = await getRoleBySlug('owner');
    const supportRole = await getRoleBySlug('support');
    expect(ownerRole).toBeTruthy();
    expect(supportRole).toBeTruthy();

    const adminSession = await loginAsAdmin(app);
    const usersRes = await adminSession.get('/api/admin/users');
    expect(usersRes.status).toBe(200);
    const users = usersRes.body?.data?.users || [];

    for (const u of users) {
      const email = String(u.email || '').toLowerCase();
      if (email === DEFAULT_ADMIN.email.toLowerCase()) continue;
      const slugs = (u.roles || []).map((r) => r.slug);
      if (slugs.includes('owner')) {
        await putUserRoles(adminSession, u.id, [supportRole.id]);
      }
    }

    const adminUser = users.find(
      (u) => String(u.email).toLowerCase() === DEFAULT_ADMIN.email.toLowerCase()
    );
    expect(adminUser).toBeTruthy();

    const ownerCount = await pool.query(
      `
      SELECT COUNT(*)::int AS count
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.slug = 'owner'
      `
    );
    expect(Number(ownerCount.rows[0].count)).toBe(1);

    const removeLast = await putUserRoles(adminSession, adminUser.id, []);
    expect(removeLast.status).toBe(409);
    expect(removeLast.body?.error?.code).toBe('LAST_OWNER');

    const locked = await updateRolePermissions(adminSession, ownerRole.id, ['can_view_orders']);
    expect(locked.status).toBe(409);
    expect(locked.body?.error?.code).toBe('OWNER_LOCKED');

    const second = await insertTestStaff({ roleSlug: 'owner' });
    secondOwnerEmail = second.email;
    const demoteSecond = await putUserRoles(adminSession, second.userId, [supportRole.id]);
    expect(demoteSecond.status).toBeLessThan(400);

    const stillOwner = await putUserRoles(adminSession, adminUser.id, []);
    expect(stillOwner.status).toBe(409);
    expect(stillOwner.body?.error?.code).toBe('LAST_OWNER');
  });
});
