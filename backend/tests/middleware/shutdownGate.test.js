// Require the 'express' module as express.
const express = require('express');
// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { createShutdownGate } = require('../../src/middleware/shutdownGate');

// Declare a test suite grouping related cases.
describe('createShutdownGate', () => {
  // Define a single test case and its expectations.
  test('allows requests while not shutting down', async () => {
    // Create the app constant.
    const app = express();
    // Call app.use to perform this step.
    app.use(createShutdownGate(() => false));
    // Call app.get to perform this step.
    app.get('/ok', (_req, res) => res.json({ ok: true }));

    // Create the response constant.
    const response = await request(app).get('/ok').expect(200);
    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({ ok: true });
  });

  // Define a single test case and its expectations.
  test('returns 503 while shutting down', async () => {
    // Create the app constant.
    const app = express();
    // Call app.use to perform this step.
    app.use((req, _res, next) => {
      // Update req.requestId with the right-hand side value.
      req.requestId = 'req-shutdown-1';
      // Call next to perform this step.
      next();
    });
    // Call app.use to perform this step.
    app.use(createShutdownGate(() => true));
    // Call app.get to perform this step.
    app.get('/ok', (_req, res) => res.json({ ok: true }));

    // Create the response constant.
    const response = await request(app).get('/ok').expect(503);
    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'SERVICE_UNAVAILABLE',
        // Provide the message field value.
        message: 'Server is restarting. Please retry in a few moments.',
        // Provide the request id field value.
        requestId: 'req-shutdown-1',
        // Provide the correlation id field value.
        correlationId: 'req-shutdown-1',
      },
    });
  });
});
