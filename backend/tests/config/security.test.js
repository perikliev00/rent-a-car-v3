// Require the 'express' module as express.
const express = require('express');
// Require the 'supertest' module as request.
const request = require('supertest');
// Require the '../../src/config/security' module as applySecurity.
const applySecurity = require('../../src/config/security');

// Declare a test suite grouping related cases.
describe('security config', () => {
  // Define the createSecurityTestApp function.
  function createSecurityTestApp(isProd = false) {
    // Create the app constant.
    const app = express();
    // Call applySecurity to perform this step.
    applySecurity(app, { isProd });
    // Call app.get to perform this step.
    app.get('/test', (_req, res) => {
      // Call res.json to perform this step.
      res.json({ ok: true });
    });
    // Return the resulting value to the caller.
    return app;
  }

  // Define a single test case and its expectations.
  test('sets security headers in development', async () => {
    // Create the app constant.
    const app = createSecurityTestApp(false);

    // Create the response constant.
    const response = await request(app).get('/test').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    // Assert that the value matches the intended expectation.
    expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    // Assert that the value matches the intended expectation.
    expect(response.headers['cross-origin-opener-policy']).toBe('same-origin');
    // Assert that the value matches the intended expectation.
    expect(response.headers['cross-origin-resource-policy']).toBe('cross-origin');
    // Assert that the value matches the intended expectation.
    expect(response.headers['permissions-policy']).toContain('camera=()');
    // Assert that the value matches the intended expectation.
    expect(response.headers['x-powered-by']).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(response.headers['strict-transport-security']).toBeUndefined();
  });

  // Define a single test case and its expectations.
  test('enables HSTS in production', async () => {
    // Create the app constant.
    const app = createSecurityTestApp(true);

    // Create the response constant.
    const response = await request(app).get('/test').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.headers['strict-transport-security']).toContain('max-age=15552000');
  });
});
