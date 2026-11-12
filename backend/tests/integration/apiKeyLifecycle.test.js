const request = require('supertest');
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { loginAsAdmin, withCsrf } = require('./helpers/sessionAgentFactory');
const { insertTestAdmin, DEFAULT_ADMIN } = require('./helpers/dbFixtures');
const { pool } = require('../helpers/dbTestHarness');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

describeIf('ADMIN-026: apiKeyLifecycle', () => {
  let app;
  let createdKeyId;

  beforeAll(async () => {
    await insertTestAdmin();
    app = createIntegrationTestApp();
  });

  afterAll(async () => {
    if (createdKeyId) {
      await pool.query(`DELETE FROM api_keys WHERE id = $1`, [createdKeyId]).catch(() => undefined);
    }
    await pool
      .query(`DELETE FROM api_keys WHERE name LIKE $1`, ['E2E API Key %'])
      .catch(() => undefined);
  });

  test('create → list (no raw) → scoped call → revoke → fail; invalid scope 422', async () => {
    const agent = await loginAsAdmin(app, {
      email: DEFAULT_ADMIN.email,
      password: DEFAULT_ADMIN.password,
    });

    const name = `E2E API Key ${Date.now()}`;
    const created = await withCsrf(agent, agent.post('/api/admin/api-keys')).send({
      name,
      scopes: ['meta:read'],
    });
    expect(created.status).toBe(201);
    const rawKey = created.body.data?.rawKey;
    const apiKey = created.body.data?.apiKey;
    expect(rawKey).toMatch(/^lux_/);
    expect(apiKey?.id).toBeTruthy();
    expect(apiKey?.keyPrefix).toBeTruthy();
    expect(apiKey?.rawKey).toBeUndefined();
    createdKeyId = Number(apiKey.id);

    const listed = await agent.get('/api/admin/api-keys').expect(200);
    const keys = listed.body.data?.apiKeys || [];
    const row = keys.find((k) => String(k.id) === String(createdKeyId));
    expect(row).toBeTruthy();
    expect(row.rawKey).toBeUndefined();
    expect(row.keyHash).toBeUndefined();
    expect(JSON.stringify(row)).not.toContain(rawKey);

    const okCall = await request(app)
      .get('/api/locations')
      .set('x-api-key', rawKey);
    expect(okCall.status).toBe(200);

    const revoked = await withCsrf(
      agent,
      agent.delete(`/api/admin/api-keys/${createdKeyId}`)
    );
    expect(revoked.status).toBe(200);
    expect(revoked.body.data?.apiKey?.revokedAt).toBeTruthy();

    const failCall = await request(app)
      .get('/api/locations')
      .set('x-api-key', rawKey);
    expect(failCall.status).toBe(401);

    const invalid = await withCsrf(agent, agent.post('/api/admin/api-keys')).send({
      name: `E2E API Key bad ${Date.now()}`,
      scopes: ['admin:write'],
    });
    expect(invalid.status).toBe(422);
  });
});
