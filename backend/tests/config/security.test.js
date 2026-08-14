const express = require('express');
const request = require('supertest');
const applySecurity = require('../../src/config/security');

describe('security config', () => {
  function createSecurityTestApp(isProd = false) {
    const app = express();
    applySecurity(app, { isProd });
    app.get('/test', (_req, res) => {
      res.json({ ok: true });
    });
    return app;
  }

  test('sets security headers in development', async () => {
    const app = createSecurityTestApp(false);

    const response = await request(app).get('/test').expect(200);

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    expect(response.headers['permissions-policy']).toContain('camera=()');
    expect(response.headers['x-powered-by']).toBeUndefined();
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  test('enables HSTS in production', async () => {
    const app = createSecurityTestApp(true);

    const response = await request(app).get('/test').expect(200);

    expect(response.headers['strict-transport-security']).toContain('max-age=15552000');
  });
});
