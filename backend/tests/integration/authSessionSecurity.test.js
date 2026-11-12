// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createIntegrationTestApp } = require('./helpers/integrationTestApp');
// Destructure object properties into local variables.
const { createSessionAgent, withCsrf } = require('./helpers/sessionAgentFactory');
// Require the '../../src/services/auth/loginAttemptService' module as loginAttemptService.
const loginAttemptService = require('../../src/services/auth/loginAttemptService');

// Create the run integration constant.
const runIntegration =
  // Update process.env.RUN_INTEGRATION_TESTS with the right-hand side value.
  process.env.RUN_INTEGRATION_TESTS === '1' && process.env.DATABASE_URL;
// Create the describe if constant.
const describeIf = runIntegration ? describe : describe.skip;

// Define the uniqueEmail function.
function uniqueEmail(prefix) {
  // Return the resulting value to the caller.
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

// Define the sessionCookieFromResponse function.
function sessionCookieFromResponse(res) {
  // Create the raw constant.
  const raw = res.headers['set-cookie'];
  // Evaluate the condition and enter the branch when it is true.
  if (!raw) return null;
  // Create the list constant.
  const list = Array.isArray(raw) ? raw : [raw];
  // Iterate using the loop initializer, condition, and step.
  for (const header of list) {
    // Create the match constant.
    const match = String(header).match(/^(?:sid|connect\.sid)=([^;]+)/i);
    // Evaluate the condition and enter the branch when it is true.
    if (match) return decodeURIComponent(match[1]);
  }
  // Return the resulting value to the caller.
  return null;
}

// Call describeIf to perform this step.
describeIf('AUTH-006: authSessionSecurity', () => {
  // Call jest.setTimeout to perform this step.
  jest.setTimeout(60_000);
  // Reserve the app variable for later assignment.
  let app;

  // Register setup that runs before the tests.
  beforeAll(() => {
    // Update app with the right-hand side value.
    app = createIntegrationTestApp();
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call loginAttemptService.resetForTests to perform this step.
    loginAttemptService.resetForTests();
  });

  // Define a single test case and its expectations.
  test('duplicate signup returns 409 EMAIL_IN_USE', async () => {
    // Create the email constant.
    const email = uniqueEmail('dup-signup');
    // Create the password constant.
    const password = 'Customer123!';

    // Create the first constant.
    const first = await createSessionAgent(app);
    // Create the created constant.
    const created = await withCsrf(first, first.post('/api/auth/signup')).send({
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Contribute this line to the enclosing declaration or statement.
      password,
    });
    // Assert that the value matches the intended expectation.
    expect(created.status).toBe(201);

    // Create the second constant.
    const second = await createSessionAgent(app);
    // Create the dup constant.
    const dup = await withCsrf(second, second.post('/api/auth/signup')).send({
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Contribute this line to the enclosing declaration or statement.
      password,
    });
    // Assert that the value matches the intended expectation.
    expect(dup.status).toBe(409);
    // Assert that the value matches the intended expectation.
    expect(dup.body.error?.code || dup.body.code).toBe('EMAIL_IN_USE');
  });

  // Define a single test case and its expectations.
  test('five bad logins lock the account with 429', async () => {
    // Create the email constant.
    const email = uniqueEmail('lockout');
    // Create the agent constant.
    const agent = await createSessionAgent(app);

    // Iterate using the loop initializer, condition, and step.
    for (let i = 0; i < 5; i += 1) {
      // Create the res constant.
      const res = await withCsrf(agent, agent.post('/api/auth/login')).send({
        // Contribute this line to the enclosing declaration or statement.
        email,
        // Provide the password field value.
        password: 'WrongPassword!!!',
      });
      // Assert that the value matches the intended expectation.
      expect([401, 429]).toContain(res.status);
    }

    // Create the locked constant.
    const locked = await withCsrf(agent, agent.post('/api/auth/login')).send({
      // Contribute this line to the enclosing declaration or statement.
      email,
      // Provide the password field value.
      password: 'WrongPassword!!!',
    });
    // Assert that the value matches the intended expectation.
    expect(locked.status).toBe(429);
    // Assert that the value matches the intended expectation.
    expect(locked.body.error?.code || locked.body.code).toBe('RATE_LIMITED');
  });

  // Define a single test case and its expectations.
  test('login regenerates session sid; logout clears auth', async () => {
    // Create the email constant.
    const email = uniqueEmail('session-rot');
    // Create the password constant.
    const password = 'Customer123!';

    // Create the signup agent constant.
    const signupAgent = await createSessionAgent(app);
    // Assert that the value matches the intended expectation.
    expect(
      // Continue the surrounding logic with this statement.
      (await withCsrf(signupAgent, signupAgent.post('/api/auth/signup')).send({ email, password }))
        // Continue the chained call started on the previous line.
        .status
    // Continue the surrounding logic with this statement.
    ).toBe(201);

    // Create the agent constant.
    const agent = request.agent(app);
    // Create the csrf res constant.
    const csrfRes = await agent.get('/api/v1/auth/csrf');
    // Create the csrf token constant.
    const csrfToken = csrfRes.body.data?.csrfToken;
    // Create the sid before constant.
    const sidBefore = sessionCookieFromResponse(csrfRes);
    // Assert that the value matches the intended expectation.
    expect(sidBefore).toBeTruthy();

    // Create the login res constant.
    const loginRes = await agent
      // Call .post to perform this step.
      .post('/api/auth/login')
      // Call .set to perform this step.
      .set('X-CSRF-Token', csrfToken)
      // Call .send to perform this step.
      .send({ email, password });
    // Assert that the value matches the intended expectation.
    expect(loginRes.status).toBe(200);
    // Create the post login token constant.
    const postLoginToken = loginRes.body.data?.csrfToken || csrfToken;

    // Create the sid after constant.
    const sidAfter = sessionCookieFromResponse(loginRes);
    // Assert that the value matches the intended expectation.
    expect(sidAfter).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(sidAfter).not.toBe(sidBefore);

    // Create the me constant.
    const me = await agent.get('/api/auth/me').set('X-CSRF-Token', postLoginToken);
    // Assert that the value matches the intended expectation.
    expect(me.status).toBe(200);

    // Create the logout constant.
    const logout = await agent.post('/api/auth/logout').set('X-CSRF-Token', postLoginToken);
    // Assert that the value matches the intended expectation.
    expect(logout.ok || logout.status === 204 || logout.status === 200).toBe(true);

    // Create the me after constant.
    const meAfter = await agent.get('/api/auth/me');
    // Assert that the value matches the intended expectation.
    expect(meAfter.status).toBe(401);
  });
});
