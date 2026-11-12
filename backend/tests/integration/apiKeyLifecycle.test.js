// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
// Destructure object properties into local variables.
const { loginAsAdmin, withCsrf } = require('./helpers/sessionAgentFactory');
// Destructure object properties into local variables.
const { insertTestAdmin, DEFAULT_ADMIN } = require('./helpers/dbFixtures');
// Destructure object properties into local variables.
const { pool } = require('../helpers/dbTestHarness');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Call describeIf to perform this step.
describeIf('ADMIN-026: apiKeyLifecycle', () => {
  // Reserve the app variable for later assignment.
  let app;
  // Reserve the created key id variable for later assignment.
  let createdKeyId;

  // Register setup that runs before the tests.
  beforeAll(async () => {
    // Wait until the asynchronous operation resolves.
    await insertTestAdmin();
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
  });

  // Register cleanup that runs after the tests.
  afterAll(async () => {
    // Evaluate the condition and enter the branch when it is true.
    if (createdKeyId) {
      // Wait until the asynchronous operation resolves.
      await pool.query(`DELETE FROM api_keys WHERE id = $1`, [createdKeyId]).catch(() => undefined);
    }
    // Wait until the asynchronous operation resolves.
    await pool
      // Call .query to perform this step.
      .query(`DELETE FROM api_keys WHERE name LIKE $1`, ['E2E API Key %'])
      // Call .catch to perform this step.
      .catch(() => undefined);
  });

  // Define a single test case and its expectations.
  test('create → list (no raw) → scoped call → revoke → fail; invalid scope 422', async () => {
    // Create the agent constant.
    const agent = await loginAsAdmin(app, {
      // Provide the email field value.
      email: DEFAULT_ADMIN.email,
      // Provide the password field value.
      password: DEFAULT_ADMIN.password,
    });

    // Create the name constant.
    const name = `E2E API Key ${Date.now()}`;
    // Create the created constant.
    const created = await withCsrf(agent, agent.post('/api/admin/api-keys')).send({
      // Contribute this line to the enclosing declaration or statement.
      name,
      // Provide the scopes field value.
      scopes: ['meta:read'],
    });
    // Assert that the value matches the intended expectation.
    expect(created.status).toBe(201);
    // Create the raw key constant.
    const rawKey = created.body.data?.rawKey;
    // Create the api key constant.
    const apiKey = created.body.data?.apiKey;
    // Assert that the value matches the intended expectation.
    expect(rawKey).toMatch(/^lux_/);
    // Assert that the value matches the intended expectation.
    expect(apiKey?.id).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(apiKey?.keyPrefix).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(apiKey?.rawKey).toBeUndefined();
    // Update createdKeyId with the right-hand side value.
    createdKeyId = Number(apiKey.id);

    // Create the listed constant.
    const listed = await agent.get('/api/admin/api-keys').expect(200);
    // Create the keys constant.
    const keys = listed.body.data?.apiKeys || [];
    // Create the row constant.
    const row = keys.find((k) => String(k.id) === String(createdKeyId));
    // Assert that the value matches the intended expectation.
    expect(row).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(row.rawKey).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(row.keyHash).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(JSON.stringify(row)).not.toContain(rawKey);

    // Create the ok call constant.
    const okCall = await request(app)
      // Call .get to perform this step.
      .get('/api/locations')
      // Call .set to perform this step.
      .set('x-api-key', rawKey);
    // Assert that the value matches the intended expectation.
    expect(okCall.status).toBe(200);

    // Create the revoked constant.
    const revoked = await withCsrf(
      // Contribute this line to the enclosing declaration or statement.
      agent,
      // Call agent.delete to perform this step.
      agent.delete(`/api/admin/api-keys/${createdKeyId}`)
    );
    // Assert that the value matches the intended expectation.
    expect(revoked.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(revoked.body.data?.apiKey?.revokedAt).toBeTruthy();

    // Create the fail call constant.
    const failCall = await request(app)
      // Call .get to perform this step.
      .get('/api/locations')
      // Call .set to perform this step.
      .set('x-api-key', rawKey);
    // Assert that the value matches the intended expectation.
    expect(failCall.status).toBe(401);

    // Create the invalid constant.
    const invalid = await withCsrf(agent, agent.post('/api/admin/api-keys')).send({
      // Provide the name field value.
      name: `E2E API Key bad ${Date.now()}`,
      // Provide the scopes field value.
      scopes: ['admin:write'],
    });
    // Assert that the value matches the intended expectation.
    expect(invalid.status).toBe(422);
  });
});
