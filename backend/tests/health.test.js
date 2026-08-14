const express = require('express');
const request = require('supertest');
const { requestIdMiddleware } = require('../src/middleware/requestIdMiddleware');
const { getLiveStatus, getReadyStatus } = require('../src/services/healthService');

describe('requestIdMiddleware', () => {
  function createApp() {
    const app = express();
    app.use(requestIdMiddleware);
    app.get('/test', (req, res) => {
      res.json({
        requestId: req.requestId,
        correlationId: req.correlationId,
      });
    });
    return app;
  }

  test('prefers incoming x-request-id header', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/test')
      .set('x-request-id', 'req-abc-123')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('req-abc-123');
    expect(response.headers['x-correlation-id']).toBe('req-abc-123');
    expect(response.body.requestId).toBe('req-abc-123');
    expect(response.body.correlationId).toBe('req-abc-123');
  });

  test('falls back to x-correlation-id when x-request-id is missing', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/test')
      .set('x-correlation-id', 'corr-legacy-456')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('corr-legacy-456');
    expect(response.body.requestId).toBe('corr-legacy-456');
  });

  test('generates a UUID when no incoming id is provided', async () => {
    const app = createApp();
    const response = await request(app).get('/test').expect(200);

    expect(response.headers['x-request-id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(response.body.requestId).toBe(response.headers['x-request-id']);
  });
});

describe('health endpoints service', () => {
  test('live status includes uptime and version', () => {
    const live = getLiveStatus();

    expect(live.status).toBe('ok');
    expect(live.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(live.version).toBeTruthy();
    expect(live.timestamp).toBeTruthy();
  });

  test('ready status aggregates dependency checks', async () => {
    const pool = {
      query: jest.fn(async (sql) => {
        if (sql === 'SELECT 1') {
          return { rows: [{ '?column?': 1 }] };
        }
        if (sql.includes('schema_migrations')) {
          return { rows: [{ name: '001_drop_legacy_bookings.sql' }] };
        }
        return { rows: [] };
      }),
      totalCount: 2,
      idleCount: 1,
      waitingCount: 0,
    };

    const ready = await getReadyStatus(pool);

    expect(ready.checks.database.ok).toBe(true);
    expect(ready.checks.redis.status).toBe('not_configured');
    expect(ready.checks.stripe).toBeDefined();
    expect(ready.checks.migrations).toBeDefined();
    expect(['ready', 'not_ready']).toContain(ready.status);
  });

  test('ready status reports not_ready when database is down', async () => {
    const pool = {
      query: jest.fn(async () => {
        throw new Error('connection refused');
      }),
      totalCount: 0,
      idleCount: 0,
      waitingCount: 0,
    };

    const ready = await getReadyStatus(pool);

    expect(ready.status).toBe('not_ready');
    expect(ready.checks.database.ok).toBe(false);
    expect(ready.checks.database.error).toMatch(/connection refused/);
  });

  test('ready status reports not_ready when migrations check fails', async () => {
    const pool = {
      query: jest.fn(async (sql) => {
        if (sql === 'SELECT 1') {
          return { rows: [{ '?column?': 1 }] };
        }
        throw new Error('schema_migrations missing');
      }),
      totalCount: 1,
      idleCount: 1,
      waitingCount: 0,
    };

    const ready = await getReadyStatus(pool);

    expect(ready.status).toBe('not_ready');
    expect(ready.checks.database.ok).toBe(true);
    expect(ready.checks.migrations.ok).toBe(false);
  });
});
