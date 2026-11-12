// Require the 'express' module as express.
const express = require('express');
// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { requestIdMiddleware } = require('../src/middleware/requestIdMiddleware');
// Destructure object properties into local variables.
const { getLiveStatus, getReadyStatus } = require('../src/services/healthService');

// Declare a test suite grouping related cases.
describe('requestIdMiddleware', () => {
  // Define the createApp function.
  function createApp() {
    // Create the app constant.
    const app = express();
    // Call app.use to perform this step.
    app.use(requestIdMiddleware);
    // Call app.get to perform this step.
    app.get('/test', (req, res) => {
      // Call res.json to perform this step.
      res.json({
        // Provide the request id field value.
        requestId: req.requestId,
        // Provide the correlation id field value.
        correlationId: req.correlationId,
      });
    });
    // Return the resulting value to the caller.
    return app;
  }

  // Define a single test case and its expectations.
  test('prefers incoming x-request-id header', async () => {
    // Create the app constant.
    const app = createApp();
    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/test')
      // Call .set to perform this step.
      .set('x-request-id', 'req-abc-123')
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.headers['x-request-id']).toBe('req-abc-123');
    // Assert that the value matches the intended expectation.
    expect(response.headers['x-correlation-id']).toBe('req-abc-123');
    // Assert that the value matches the intended expectation.
    expect(response.body.requestId).toBe('req-abc-123');
    // Assert that the value matches the intended expectation.
    expect(response.body.correlationId).toBe('req-abc-123');
  });

  // Define a single test case and its expectations.
  test('falls back to x-correlation-id when x-request-id is missing', async () => {
    // Create the app constant.
    const app = createApp();
    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/test')
      // Call .set to perform this step.
      .set('x-correlation-id', 'corr-legacy-456')
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.headers['x-request-id']).toBe('corr-legacy-456');
    // Assert that the value matches the intended expectation.
    expect(response.body.requestId).toBe('corr-legacy-456');
  });

  // Define a single test case and its expectations.
  test('generates a UUID when no incoming id is provided', async () => {
    // Create the app constant.
    const app = createApp();
    // Create the response constant.
    const response = await request(app).get('/test').expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.headers['x-request-id']).toMatch(
      // Contribute this line to the enclosing declaration or statement.
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    // Assert that the value matches the intended expectation.
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });
});

// Declare a test suite grouping related cases.
describe('health endpoints service', () => {
  // Define a single test case and its expectations.
  test('live status includes uptime and version', () => {
    // Create the live constant.
    const live = getLiveStatus();

    // Assert that the value matches the intended expectation.
    expect(live.status).toBe('ok');
    // Assert that the value matches the intended expectation.
    expect(live.uptimeSeconds).toBeGreaterThanOrEqual(0);
    // Assert that the value matches the intended expectation.
    expect(live.version).toBeTruthy();
    // Assert that the value matches the intended expectation.
    expect(live.timestamp).toBeTruthy();
  });

  // Define a single test case and its expectations.
  test('ready status aggregates dependency checks', async () => {
    // Create the pool constant.
    const pool = {
      // Provide the query field value.
      query: jest.fn(async (sql) => {
        // Evaluate the condition and enter the branch when it is true.
        if (sql === 'SELECT 1') {
          // Return the resulting value to the caller.
          return { rows: [{ '?column?': 1 }] };
        }
        // Evaluate the condition and enter the branch when it is true.
        if (sql.includes('schema_migrations')) {
          // Return the resulting value to the caller.
          return { rows: [{ name: '001_drop_legacy_bookings.sql' }] };
        }
        // Return the resulting value to the caller.
        return { rows: [] };
      }),
      // Provide the total count field value.
      totalCount: 2,
      // Provide the idle count field value.
      idleCount: 1,
      // Provide the waiting count field value.
      waitingCount: 0,
    };

    // Create the ready constant.
    const ready = await getReadyStatus(pool);

    // Assert that the value matches the intended expectation.
    expect(ready.checks.database.ok).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(ready.checks.redis.status).toBe('not_configured');
    // Assert that the value matches the intended expectation.
    expect(ready.checks.stripe).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(ready.checks.migrations).toBeDefined();
    // Assert that the value matches the intended expectation.
    expect(['ready', 'not_ready']).toContain(ready.status);
  });

  // Define a single test case and its expectations.
  test('ready status reports not_ready when database is down', async () => {
    // Create the pool constant.
    const pool = {
      // Provide the query field value.
      query: jest.fn(async () => {
        // Throw an error to stop the current control flow.
        throw new Error('connection refused');
      }),
      // Provide the total count field value.
      totalCount: 0,
      // Provide the idle count field value.
      idleCount: 0,
      // Provide the waiting count field value.
      waitingCount: 0,
    };

    // Create the ready constant.
    const ready = await getReadyStatus(pool);

    // Assert that the value matches the intended expectation.
    expect(ready.status).toBe('not_ready');
    // Assert that the value matches the intended expectation.
    expect(ready.checks.database.ok).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(ready.checks.database.error).toMatch(/connection refused/);
  });

  // Define a single test case and its expectations.
  test('ready status reports not_ready when migrations check fails', async () => {
    // Create the pool constant.
    const pool = {
      // Provide the query field value.
      query: jest.fn(async (sql) => {
        // Evaluate the condition and enter the branch when it is true.
        if (sql === 'SELECT 1') {
          // Return the resulting value to the caller.
          return { rows: [{ '?column?': 1 }] };
        }
        // Throw an error to stop the current control flow.
        throw new Error('schema_migrations missing');
      }),
      // Provide the total count field value.
      totalCount: 1,
      // Provide the idle count field value.
      idleCount: 1,
      // Provide the waiting count field value.
      waitingCount: 0,
    };

    // Create the ready constant.
    const ready = await getReadyStatus(pool);

    // Assert that the value matches the intended expectation.
    expect(ready.status).toBe('not_ready');
    // Assert that the value matches the intended expectation.
    expect(ready.checks.database.ok).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(ready.checks.migrations.ok).toBe(false);
  });
});
