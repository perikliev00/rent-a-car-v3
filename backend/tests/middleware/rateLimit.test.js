const express = require('express');
const request = require('supertest');

describe('rateLimit middleware behavior', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    jest.resetModules();
  });

  test.each([
    ['authLimiter'],
    ['loginLimiter'],
    ['signupLimiter'],
    ['emailVerificationLimiter'],
    ['adminReadLimiter'],
    ['adminWriteLimiter'],
    ['adminRealtimeLimiter'],
    ['adminUploadLimiter'],
    ['accountUploadLimiter'],
    ['checkoutLimiter'],
    ['bookingLimiter'],
    ['chatLimiter'],
    ['contactLimiter'],
  ])('%s is a middleware function', (name) => {
    jest.resetModules();
    const limiters = require('../../src/middleware/rateLimit');
    expect(typeof limiters[name]).toBe('function');
  });

  test('loginLimiter returns 429 after exceeding max', async () => {
    process.env.RATE_LIMIT_LOGIN_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    jest.resetModules();

    const { loginLimiter } = require('../../src/middleware/rateLimit');
    const app = express();
    app.use(loginLimiter);
    app.post('/login', (_req, res) => res.json({ ok: true }));

    await request(app).post('/login').expect(200);

    const limited = await request(app).post('/login').expect(429);
    expect(limited.body.success).toBe(false);
    expect(limited.body.error?.code || limited.body.code).toBe('RATE_LIMITED');
  });

  test('checkoutLimiter returns 429 after exceeding max', async () => {
    process.env.RATE_LIMIT_CHECKOUT_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    jest.resetModules();

    const { checkoutLimiter } = require('../../src/middleware/rateLimit');
    const app = express();
    app.use(checkoutLimiter);
    app.post('/checkout', (_req, res) => res.json({ ok: true }));

    await request(app).post('/checkout').expect(200);
    const limited = await request(app).post('/checkout').expect(429);
    expect(limited.body.success).toBe(false);
    expect(limited.body.error?.code || limited.body.code).toBe('RATE_LIMITED');
  });

  function mountAdminApp(limiters) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      const staffId = req.headers['x-staff-id'];
      const sessionId = req.headers['x-session-id'];
      if (staffId || sessionId) {
        req.session = staffId ? { user: { id: staffId } } : {};
        req.sessionID = sessionId || `sess-${staffId}`;
      }
      next();
    });
    app.use(
      '/admin',
      limiters.adminReadLimiter,
      limiters.adminWriteLimiter,
      limiters.adminRealtimeLimiter
    );
    app.get('/admin/ops', (_req, res) => res.json({ ok: true }));
    app.post('/admin/reservations/:id/status', (_req, res) => res.json({ ok: true }));
    app.get('/admin/realtime/stream', (_req, res) => res.json({ ok: true }));
    return app;
  }

  test('write exhaustion must never take admin reads offline', async () => {
    process.env.RATE_LIMIT_ADMIN_WRITE_MAX = '2';
    process.env.RATE_LIMIT_ADMIN_READ_MAX = '100';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    jest.resetModules();

    const limiters = require('../../src/middleware/rateLimit');
    const app = mountAdminApp(limiters);

    await request(app).get('/admin/ops').expect(200);
    await request(app).post('/admin/reservations/1/status').expect(200);
    await request(app).post('/admin/reservations/1/status').expect(200);

    const limited = await request(app).post('/admin/reservations/1/status').expect(429);
    expect(limited.body.success).toBe(false);
    expect(limited.body.error?.code || limited.body.code).toBe('RATE_LIMITED');
    expect(limited.headers['x-ratelimit-policy']).toBe('admin-write');

    await request(app).get('/admin/ops').expect(200);
  });

  test('staff keys do not share a write counter', async () => {
    process.env.RATE_LIMIT_ADMIN_WRITE_MAX = '1';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    jest.resetModules();

    const limiters = require('../../src/middleware/rateLimit');
    const app = mountAdminApp(limiters);

    await request(app).post('/admin/reservations/1/status').set('x-staff-id', '1').expect(200);
    await request(app).post('/admin/reservations/1/status').set('x-staff-id', '1').expect(429);
    await request(app).post('/admin/reservations/1/status').set('x-staff-id', '2').expect(200);
  });

  test('adminRateLimitKey falls back to IP without session', () => {
    jest.resetModules();
    const { adminRateLimitKey } = require('../../src/middleware/rateLimit');
    expect(adminRateLimitKey({ ip: '203.0.113.10' })).toMatch(/^ip:/);
    expect(adminRateLimitKey({ session: { user: { id: 42 } } })).toBe('staff:42');
    expect(adminRateLimitKey({ sessionID: 'abc' })).toBe('session:abc');
  });

  test('realtime stream is excluded from the read limiter and has its own policy', async () => {
    process.env.RATE_LIMIT_ADMIN_READ_MAX = '1';
    process.env.RATE_LIMIT_ADMIN_REALTIME_MAX = '2';
    process.env.RATE_LIMIT_ADMIN_REALTIME_WINDOW_MS = '60000';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    jest.resetModules();

    const limiters = require('../../src/middleware/rateLimit');
    const app = mountAdminApp(limiters);

    await request(app).get('/admin/ops').expect(200);
    const readLimited = await request(app).get('/admin/ops').expect(429);
    expect(readLimited.headers['x-ratelimit-policy']).toBe('admin-read');

    await request(app).get('/admin/realtime/stream').expect(200);
    await request(app).get('/admin/realtime/stream').expect(200);
    const realtimeLimited = await request(app).get('/admin/realtime/stream').expect(429);
    expect(realtimeLimited.headers['x-ratelimit-policy']).toBe('admin-realtime');
  });

  test('write exhaustion does not block the first SSE connect', async () => {
    process.env.RATE_LIMIT_ADMIN_WRITE_MAX = '1';
    process.env.RATE_LIMIT_ADMIN_READ_MAX = '100';
    process.env.RATE_LIMIT_ADMIN_REALTIME_MAX = '10';
    process.env.RATE_LIMIT_WINDOW_MS = '60000';
    jest.resetModules();

    const limiters = require('../../src/middleware/rateLimit');
    const app = mountAdminApp(limiters);

    await request(app).post('/admin/reservations/1/status').expect(200);
    await request(app).post('/admin/reservations/1/status').expect(429);
    await request(app).get('/admin/realtime/stream').expect(200);
    await request(app).get('/admin/ops').expect(200);
  });
});
