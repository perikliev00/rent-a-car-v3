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
    ['adminLimiter'],
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
});
