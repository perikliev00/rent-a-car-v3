const request = require('supertest');
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
const { createSessionAgent, withCsrf } = require('./helpers/sessionAgentFactory');
const loginAttemptService = require('../../src/services/auth/loginAttemptService');

const runIntegration =
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
const describeIf = runIntegration ? describe : describe.skip;

function uniqueEmail(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function sessionCookieFromResponse(res) {
  const raw = res.headers['set-cookie'];
  if (!raw) return null;
  const list = Array.isArray(raw) ? raw : [raw];
  for (const header of list) {
    const match = String(header).match(/^(?:sid|connect\.sid)=([^;]+)/i);
    if (match) return decodeURIComponent(match[1]);
  }
  return null;
}

describeIf('AUTH-006: authSessionSecurity', () => {
  jest.setTimeout(60_000);
  let app;

  beforeAll(() => {
    app = createIntegrationTestApp();
  });

  afterEach(() => {
    loginAttemptService.resetForTests();
  });

  test('duplicate signup returns 409 EMAIL_IN_USE', async () => {
    const email = uniqueEmail('dup-signup');
    const password = 'Customer123!';

    const first = await createSessionAgent(app);
    const created = await withCsrf(first, first.post('/api/auth/signup')).send({
      email,
      password,
    });
    expect(created.status).toBe(201);

    const second = await createSessionAgent(app);
    const dup = await withCsrf(second, second.post('/api/auth/signup')).send({
      email,
      password,
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error?.code || dup.body.code).toBe('EMAIL_IN_USE');
  });

  test('five bad logins lock the account with 429', async () => {
    const email = uniqueEmail('lockout');
    const agent = await createSessionAgent(app);

    for (let i = 0; i < 5; i += 1) {
      const res = await withCsrf(agent, agent.post('/api/auth/login')).send({
        email,
        password: 'WrongPassword!!!',
      });
      expect([401, 429]).toContain(res.status);
    }

    const locked = await withCsrf(agent, agent.post('/api/auth/login')).send({
      email,
      password: 'WrongPassword!!!',
    });
    expect(locked.status).toBe(429);
    expect(locked.body.error?.code || locked.body.code).toBe('RATE_LIMITED');
  });

  test('login regenerates session sid; logout clears auth', async () => {
    const email = uniqueEmail('session-rot');
    const password = 'Customer123!';

    const signupAgent = await createSessionAgent(app);
    expect(
      (await withCsrf(signupAgent, signupAgent.post('/api/auth/signup')).send({ email, password }))
        .status
    ).toBe(201);

    const agent = request.agent(app);
    const csrfRes = await agent.get('/api/v1/auth/csrf');
    const csrfToken = csrfRes.body.data?.csrfToken;
    const sidBefore = sessionCookieFromResponse(csrfRes);
    expect(sidBefore).toBeTruthy();

    const loginRes = await agent
      .post('/api/auth/login')
      .set('X-CSRF-Token', csrfToken)
      .send({ email, password });
    expect(loginRes.status).toBe(200);
    const postLoginToken = loginRes.body.data?.csrfToken || csrfToken;

    const sidAfter = sessionCookieFromResponse(loginRes);
    expect(sidAfter).toBeTruthy();
    expect(sidAfter).not.toBe(sidBefore);

    const me = await agent.get('/api/auth/me').set('X-CSRF-Token', postLoginToken);
    expect(me.status).toBe(200);

    const logout = await agent.post('/api/auth/logout').set('X-CSRF-Token', postLoginToken);
    expect(logout.ok || logout.status === 204 || logout.status === 200).toBe(true);

    const meAfter = await agent.get('/api/auth/me');
    expect(meAfter.status).toBe(401);
  });
});
