// Require the 'express' module as express.
const express = require('express');
// Require the 'supertest' module as request.
const request = require('supertest');

// Call jest.mock to perform this step.
jest.mock('../../src/monitoring/metrics', () => ({
  // Provide the record request field value.
  recordRequest: jest.fn(),
  // Provide the increment errors field value.
  incrementErrors: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/monitoring/logEvent', () => ({
  // Provide the warn field value.
  warn: jest.fn(),
  // Provide the info field value.
  info: jest.fn(),
}));

// Require the '../../src/monitoring/metrics' module as metrics.
const metrics = require('../../src/monitoring/metrics');
// Require the '../../src/middleware/requestMetrics' module as requestMetrics.
const requestMetrics = require('../../src/middleware/requestMetrics');

// Declare a test suite grouping related cases.
describe('requestMetrics', () => {
  // Define the createApp function.
  function createApp() {
    // Create the app constant.
    const app = express();
    // Call app.use to perform this step.
    app.use(requestMetrics);
    // Call app.get to perform this step.
    app.get('/api/test', (_req, res) => {
      // Call res.status to perform this step.
      res.status(200).json({ ok: true });
    });
    // Call app.get to perform this step.
    app.get('/health', (_req, res) => {
      // Call res.status to perform this step.
      res.status(200).send('ok');
    });
    // Return the resulting value to the caller.
    return app;
  }

  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('records request metrics on response finish', async () => {
    // Create the app constant.
    const app = createApp();

    // Wait until the asynchronous operation resolves.
    await request(app).get('/api/test').expect(200);

    // Assert that the value matches the intended expectation.
    expect(metrics.recordRequest).toHaveBeenCalledWith(
      // Supply the literal value used by the enclosing expression.
      'GET',
      // Supply the literal value used by the enclosing expression.
      '/api/test',
      // Supply the literal value used by the enclosing expression.
      200,
      // Call expect.any to perform this step.
      expect.any(Number),
      // Call expect.any to perform this step.
      expect.any(String)
    );
  });

  // Define a single test case and its expectations.
  test('skips metrics for health probe paths', async () => {
    // Create the app constant.
    const app = createApp();

    // Wait until the asynchronous operation resolves.
    await request(app).get('/health').expect(200);

    // Assert that the value matches the intended expectation.
    expect(metrics.recordRequest).not.toHaveBeenCalled();
  });
});
