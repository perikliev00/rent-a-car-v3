// Require the 'express' module as express.
const express = require('express');
// Require the 'supertest' module as request.
const request = require('supertest');

// Declare a test suite grouping related cases.
describe('rateLimit middleware behavior', () => {
  // Create the original env constant.
  const originalEnv = { ...process.env };

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Update process.env with the right-hand side value.
    process.env = { ...originalEnv };
    // Call jest.resetModules to perform this step.
    jest.resetModules();
  });

  // Call test.each to perform this step.
  test.each([
    // Contribute this line to the enclosing declaration or statement.
    ['authLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['loginLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['signupLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['emailVerificationLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['adminReadLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['adminWriteLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['adminRealtimeLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['adminUploadLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['accountUploadLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['checkoutLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['bookingLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['chatLimiter'],
    // Contribute this line to the enclosing declaration or statement.
    ['contactLimiter'],
  // Continue the surrounding logic with this statement.
  ])('%s is a middleware function', (name) => {
    // Call jest.resetModules to perform this step.
    jest.resetModules();
    // Require the '../../src/middleware/rateLimit' module as limiters.
    const limiters = require('../../src/middleware/rateLimit');
    // Assert that the value matches the intended expectation.
    expect(typeof limiters[name]).toBe('function');
  });

  // Define a single test case and its expectations.
  test('loginLimiter returns 429 after exceeding max', async () => {
    // Update process.env.RATE_LIMIT_LOGIN_MAX with the right-hand side value.
    process.env.RATE_LIMIT_LOGIN_MAX = '1';
    // Update process.env.RATE_LIMIT_WINDOW_MS with the right-hand side value.
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    // Call jest.resetModules to perform this step.
    jest.resetModules();

    // Destructure object properties into local variables.
    const { loginLimiter } = require('../../src/middleware/rateLimit');
    // Create the app constant.
    const app = express();
    // Call app.use to perform this step.
    app.use(loginLimiter);
    // Call app.post to perform this step.
    app.post('/login', (_req, res) => res.json({ ok: true }));

    // Wait until the asynchronous operation resolves.
    await request(app).post('/login').expect(200);

    // Create the limited constant.
    const limited = await request(app).post('/login').expect(429);
    // Assert that the value matches the intended expectation.
    expect(limited.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(limited.body.error?.code || limited.body.code).toBe('RATE_LIMITED');
  });

  // Define a single test case and its expectations.
  test('checkoutLimiter returns 429 after exceeding max', async () => {
    // Update process.env.RATE_LIMIT_CHECKOUT_MAX with the right-hand side value.
    process.env.RATE_LIMIT_CHECKOUT_MAX = '1';
    // Update process.env.RATE_LIMIT_WINDOW_MS with the right-hand side value.
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    // Call jest.resetModules to perform this step.
    jest.resetModules();

    // Destructure object properties into local variables.
    const { checkoutLimiter } = require('../../src/middleware/rateLimit');
    // Create the app constant.
    const app = express();
    // Call app.use to perform this step.
    app.use(checkoutLimiter);
    // Call app.post to perform this step.
    app.post('/checkout', (_req, res) => res.json({ ok: true }));

    // Wait until the asynchronous operation resolves.
    await request(app).post('/checkout').expect(200);
    // Create the limited constant.
    const limited = await request(app).post('/checkout').expect(429);
    // Assert that the value matches the intended expectation.
    expect(limited.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(limited.body.error?.code || limited.body.code).toBe('RATE_LIMITED');
  });

  // Define the mountAdminApp function.
  function mountAdminApp(limiters) {
    // Create the app constant.
    const app = express();
    // Call app.use to perform this step.
    app.use(express.json());
    // Call app.use to perform this step.
    app.use((req, _res, next) => {
      // Create the staff id constant.
      const staffId = req.headers['x-staff-id'];
      // Create the session id constant.
      const sessionId = req.headers['x-session-id'];
      // Evaluate the condition and enter the branch when it is true.
      if (staffId || sessionId) {
        // Update req.session with the right-hand side value.
        req.session = staffId ? { user: { id: staffId } } : {};
        // Update req.sessionID with the right-hand side value.
        req.sessionID = sessionId || `sess-${staffId}`;
      }
      // Call next to perform this step.
      next();
    });
    // Call app.use to perform this step.
    app.use(
      // Supply the literal value used by the enclosing expression.
      '/admin',
      // Contribute this line to the enclosing declaration or statement.
      limiters.adminReadLimiter,
      // Contribute this line to the enclosing declaration or statement.
      limiters.adminWriteLimiter,
      // Contribute this line to the enclosing declaration or statement.
      limiters.adminRealtimeLimiter
    );
    // Call app.get to perform this step.
    app.get('/admin/ops', (_req, res) => res.json({ ok: true }));
    // Call app.post to perform this step.
    app.post('/admin/reservations/:id/status', (_req, res) => res.json({ ok: true }));
    // Call app.get to perform this step.
    app.get('/admin/realtime/stream', (_req, res) => res.json({ ok: true }));
    // Return the resulting value to the caller.
    return app;
  }

  // Define a single test case and its expectations.
  test('write exhaustion must never take admin reads offline', async () => {
    // Update process.env.RATE_LIMIT_ADMIN_WRITE_MAX with the right-hand side value.
    process.env.RATE_LIMIT_ADMIN_WRITE_MAX = '2';
    // Update process.env.RATE_LIMIT_ADMIN_READ_MAX with the right-hand side value.
    process.env.RATE_LIMIT_ADMIN_READ_MAX = '100';
    // Update process.env.RATE_LIMIT_WINDOW_MS with the right-hand side value.
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    // Call jest.resetModules to perform this step.
    jest.resetModules();

    // Require the '../../src/middleware/rateLimit' module as limiters.
    const limiters = require('../../src/middleware/rateLimit');
    // Create the app constant.
    const app = mountAdminApp(limiters);

    // Wait until the asynchronous operation resolves.
    await request(app).get('/admin/ops').expect(200);
    // Wait until the asynchronous operation resolves.
    await request(app).post('/admin/reservations/1/status').expect(200);
    // Wait until the asynchronous operation resolves.
    await request(app).post('/admin/reservations/1/status').expect(200);

    // Create the limited constant.
    const limited = await request(app).post('/admin/reservations/1/status').expect(429);
    // Assert that the value matches the intended expectation.
    expect(limited.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(limited.body.error?.code || limited.body.code).toBe('RATE_LIMITED');
    // Assert that the value matches the intended expectation.
    expect(limited.headers['x-ratelimit-policy']).toBe('admin-write');

    // Wait until the asynchronous operation resolves.
    await request(app).get('/admin/ops').expect(200);
  });

  // Define a single test case and its expectations.
  test('staff keys do not share a write counter', async () => {
    // Update process.env.RATE_LIMIT_ADMIN_WRITE_MAX with the right-hand side value.
    process.env.RATE_LIMIT_ADMIN_WRITE_MAX = '1';
    // Update process.env.RATE_LIMIT_WINDOW_MS with the right-hand side value.
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    // Call jest.resetModules to perform this step.
    jest.resetModules();

    // Require the '../../src/middleware/rateLimit' module as limiters.
    const limiters = require('../../src/middleware/rateLimit');
    // Create the app constant.
    const app = mountAdminApp(limiters);

    // Wait until the asynchronous operation resolves.
    await request(app).post('/admin/reservations/1/status').set('x-staff-id', '1').expect(200);
    // Wait until the asynchronous operation resolves.
    await request(app).post('/admin/reservations/1/status').set('x-staff-id', '1').expect(429);
    // Wait until the asynchronous operation resolves.
    await request(app).post('/admin/reservations/1/status').set('x-staff-id', '2').expect(200);
  });

  // Define a single test case and its expectations.
  test('adminRateLimitKey falls back to IP without session', () => {
    // Call jest.resetModules to perform this step.
    jest.resetModules();
    // Destructure object properties into local variables.
    const { adminRateLimitKey } = require('../../src/middleware/rateLimit');
    // Assert that the value matches the intended expectation.
    expect(adminRateLimitKey({ ip: '203.0.113.10' })).toMatch(/^ip:/);
    // Assert that the value matches the intended expectation.
    expect(adminRateLimitKey({ session: { user: { id: 42 } } })).toBe('staff:42');
    // Assert that the value matches the intended expectation.
    expect(adminRateLimitKey({ sessionID: 'abc' })).toBe('session:abc');
  });

  // Define a single test case and its expectations.
  test('realtime stream is excluded from the read limiter and has its own policy', async () => {
    // Update process.env.RATE_LIMIT_ADMIN_READ_MAX with the right-hand side value.
    process.env.RATE_LIMIT_ADMIN_READ_MAX = '1';
    // Update process.env.RATE_LIMIT_ADMIN_REALTIME_MAX with the right-hand side value.
    process.env.RATE_LIMIT_ADMIN_REALTIME_MAX = '2';
    // Update process.env.RATE_LIMIT_ADMIN_REALTIME_WINDOW_MS with the right-hand side value.
    process.env.RATE_LIMIT_ADMIN_REALTIME_WINDOW_MS = '60000';
    // Update process.env.RATE_LIMIT_WINDOW_MS with the right-hand side value.
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    // Call jest.resetModules to perform this step.
    jest.resetModules();

    // Require the '../../src/middleware/rateLimit' module as limiters.
    const limiters = require('../../src/middleware/rateLimit');
    // Create the app constant.
    const app = mountAdminApp(limiters);

    // Wait until the asynchronous operation resolves.
    await request(app).get('/admin/ops').expect(200);
    // Create the read limited constant.
    const readLimited = await request(app).get('/admin/ops').expect(429);
    // Assert that the value matches the intended expectation.
    expect(readLimited.headers['x-ratelimit-policy']).toBe('admin-read');

    // Wait until the asynchronous operation resolves.
    await request(app).get('/admin/realtime/stream').expect(200);
    // Wait until the asynchronous operation resolves.
    await request(app).get('/admin/realtime/stream').expect(200);
    // Create the realtime limited constant.
    const realtimeLimited = await request(app).get('/admin/realtime/stream').expect(429);
    // Assert that the value matches the intended expectation.
    expect(realtimeLimited.headers['x-ratelimit-policy']).toBe('admin-realtime');
  });

  // Define a single test case and its expectations.
  test('write exhaustion does not block the first SSE connect', async () => {
    // Update process.env.RATE_LIMIT_ADMIN_WRITE_MAX with the right-hand side value.
    process.env.RATE_LIMIT_ADMIN_WRITE_MAX = '1';
    // Update process.env.RATE_LIMIT_ADMIN_READ_MAX with the right-hand side value.
    process.env.RATE_LIMIT_ADMIN_READ_MAX = '100';
    // Update process.env.RATE_LIMIT_ADMIN_REALTIME_MAX with the right-hand side value.
    process.env.RATE_LIMIT_ADMIN_REALTIME_MAX = '10';
    // Update process.env.RATE_LIMIT_WINDOW_MS with the right-hand side value.
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    // Call jest.resetModules to perform this step.
    jest.resetModules();

    // Require the '../../src/middleware/rateLimit' module as limiters.
    const limiters = require('../../src/middleware/rateLimit');
    // Create the app constant.
    const app = mountAdminApp(limiters);

    // Wait until the asynchronous operation resolves.
    await request(app).post('/admin/reservations/1/status').expect(200);
    // Wait until the asynchronous operation resolves.
    await request(app).post('/admin/reservations/1/status').expect(429);
    // Wait until the asynchronous operation resolves.
    await request(app).get('/admin/realtime/stream').expect(200);
    // Wait until the asynchronous operation resolves.
    await request(app).get('/admin/ops').expect(200);
  });
});
