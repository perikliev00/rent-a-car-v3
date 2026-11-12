// Destructure object properties into local variables.
const { pool } = require('../helpers/dbTestHarness');
// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  loginAsAdmin,
  // Contribute this line to the enclosing declaration or statement.
  putUserRoles,
  // Contribute this line to the enclosing declaration or statement.
  updateRolePermissions,
// Continue the surrounding logic with this statement.
} = require('./helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  DEFAULT_ADMIN,
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
  // Contribute this line to the enclosing declaration or statement.
  insertTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  getRoleBySlug,
// Continue the surrounding logic with this statement.
} = require('./helpers/dbFixtures');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('AUTH-005: rbacOwnerInvariants', () => {
  // Call jest.setTimeout to perform this step.
  jest.setTimeout(60_000);
  // Reserve the app variable for later assignment.
  let app;
  // Initialize the mutable second owner email variable.
  let secondOwnerEmail = null;

  // Register setup that runs before the tests.
  beforeAll(async () => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
  });

  // Register cleanup that runs after the tests.
  afterAll(async () => {
    // Evaluate the condition and enter the branch when it is true.
    if (secondOwnerEmail) await cleanupTestStaff(secondOwnerEmail).catch(() => undefined);
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
  });

  // Define a single test case and its expectations.
  test('cannot remove last owner or edit owner permissions', async () => {
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
    // Create the owner role constant.
    const ownerRole = await getRoleBySlug('owner');
    // Create the support role constant.
    const supportRole = await getRoleBySlug('support');
    // Assert that the value matches the intended expectation.
    expect(ownerRole).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(supportRole).toBeTruthy();

    // Create the admin session constant.
    const adminSession = await loginAsAdmin(app);
    // Create the users res constant.
    const usersRes = await adminSession.get('/api/admin/users');
    // Assert that the value matches the intended expectation.
    expect(usersRes.status).toBe(200);
    // Create the users constant.
    const users = usersRes.body?.data?.users || [];

    // Iterate using the loop initializer, condition, and step.
    for (const u of users) {
      // Create the email constant.
      const email = String(u.email || '').toLowerCase();
      // Evaluate the condition and enter the branch when it is true.
      if (email === DEFAULT_ADMIN.email.toLowerCase()) continue;
      // Create the slugs constant.
      const slugs = (u.roles || []).map((r) => r.slug);
      // Evaluate the condition and enter the branch when it is true.
      if (slugs.includes('owner')) {
        // Wait until the asynchronous operation resolves.
        await putUserRoles(adminSession, u.id, [supportRole.id]);
      }
    }

    // Create the admin user constant.
    const adminUser = users.find(
      // Continue the surrounding logic with this statement.
      (u) => String(u.email).toLowerCase() === DEFAULT_ADMIN.email.toLowerCase()
    );
    // Assert that the value matches the intended expectation.
    expect(adminUser).toBeTruthy();

    // Create the owner count constant.
    const ownerCount = await pool.query(
      // Continue the surrounding logic with this statement.
      `
      SELECT COUNT(*)::int AS count
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE r.slug = 'owner'
      `
    );
    // Assert that the value matches the intended expectation.
    expect(Number(ownerCount.rows[0].count)).toBe(1);

    // Create the remove last constant.
    const removeLast = await putUserRoles(adminSession, adminUser.id, []);
    // Assert that the value matches the intended expectation.
    expect(removeLast.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(removeLast.body?.error?.code).toBe('LAST_OWNER');

    // Create the locked constant.
    const locked = await updateRolePermissions(adminSession, ownerRole.id, ['can_view_orders']);
    // Assert that the value matches the intended expectation.
    expect(locked.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(locked.body?.error?.code).toBe('OWNER_LOCKED');

    // Create the second constant.
    const second = await insertTestStaff({ roleSlug: 'owner' });
    // Update secondOwnerEmail with the right-hand side value.
    secondOwnerEmail = second.email;
    // Create the demote second constant.
    const demoteSecond = await putUserRoles(adminSession, second.userId, [supportRole.id]);
    // Assert that the value matches the intended expectation.
    expect(demoteSecond.status).toBeLessThan(400);

    // Create the still owner constant.
    const stillOwner = await putUserRoles(adminSession, adminUser.id, []);
    // Assert that the value matches the intended expectation.
    expect(stillOwner.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(stillOwner.body?.error?.code).toBe('LAST_OWNER');
  });
});
