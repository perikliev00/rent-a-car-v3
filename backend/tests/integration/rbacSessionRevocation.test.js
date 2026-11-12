// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
// Destructure object properties into local variables.
const { loginAsStaff, loginAsAdmin, putUserRoles } = require('./helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  insertTestAdmin,
  // Contribute this line to the enclosing declaration or statement.
  insertTestStaff,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTestStaff,
// Continue the surrounding logic with this statement.
} = require('./helpers/dbFixtures');
// Destructure object properties into local variables.
const { pool } = require('../helpers/dbTestHarness');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('AUTH-002: rbacSessionRevocation', () => {
  // Call jest.setTimeout to perform this step.
  jest.setTimeout(60_000);

  // Reserve the app variable for later assignment.
  let app;
  // Reserve the staff variable for later assignment.
  let staff;

  // Register setup that runs before the tests.
  beforeAll(async () => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp({ usePgSessionStore: true });
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
    // Store the awaited result in staff.
    staff = await insertTestStaff({ roleSlug: 'receptionist' });
  });

  // Register cleanup that runs after the tests.
  afterAll(async () => {
    // Evaluate the condition and enter the branch when it is true.
    if (staff?.email) await cleanupTestStaff(staff.email).catch(() => undefined);
  });

  // Define a single test case and its expectations.
  test('clearing staff roles destroys session; next API is unauthorized', async () => {
    // Create the session constant.
    const session = await loginAsStaff(app, staff);

    // Create the before constant.
    const before = await session.get('/api/admin/reservations/ops-dashboard');
    // Assert that the value matches the intended expectation.
    expect(before.status).toBe(200);

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the cleared constant.
    const cleared = await putUserRoles(admin, staff.userId, []);
    // Assert that the value matches the intended expectation.
    expect(cleared.status).toBeLessThan(400);

    // Create the after constant.
    const after = await session.get('/api/admin/reservations/ops-dashboard');
    // Assert that the value matches the intended expectation.
    expect([401, 403]).toContain(after.status);
  });

  // Define a single test case and its expectations.
  test('stale users.role=staff cannot restore access after RBAC removal', async () => {
    // Create the again constant.
    const again = await insertTestStaff({
      // Provide the role slug field value.
      roleSlug: 'receptionist',
      // Provide the email field value.
      email: staff.email,
      // Provide the password field value.
      password: staff.password,
    });
    // Update staff with the right-hand side value.
    staff = again;

    // Create the admin constant.
    const admin = await loginAsAdmin(app);
    // Create the cleared constant.
    const cleared = await putUserRoles(admin, staff.userId, []);
    // Assert that the value matches the intended expectation.
    expect(cleared.status).toBeLessThan(400);

    // Force stale legacy column (simulates pre-cleanup DB / missed demote)
    await pool.query(`UPDATE users SET role = 'staff', updated_at = NOW() WHERE id = $1`, [
      // Contribute this line to the enclosing declaration or statement.
      staff.userId,
    ]);

    // Create the role row constant.
    const roleRow = await pool.query(`SELECT role FROM users WHERE id = $1`, [staff.userId]);
    // Assert that the value matches the intended expectation.
    expect(roleRow.rows[0].role).toBe('staff');

    // Create the ur constant.
    const ur = await pool.query(`SELECT 1 FROM user_roles WHERE user_id = $1`, [staff.userId]);
    // Assert that the value matches the intended expectation.
    expect(ur.rowCount).toBe(0);

    // Create the re login constant.
    const reLogin = await loginAsStaff(app, staff);
    // Create the probe constant.
    const probe = await reLogin.get('/api/admin/reservations/ops-dashboard');
    // Assert that the value matches the intended expectation.
    expect([401, 403]).toContain(probe.status);
    // Assert that the value matches the intended expectation.
    expect(probe.status).not.toBe(200);
  });
});
