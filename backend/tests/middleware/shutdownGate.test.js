const express = require('express');
const request = require('supertest');
const { createShutdownGate } = require('../../src/middleware/shutdownGate');

describe('createShutdownGate', () => {
  test('allows requests while not shutting down', async () => {
    const app = express();
    app.use(createShutdownGate(() => false));
    app.get('/ok', (_req, res) => res.json({ ok: true }));

    const response = await request(app).get('/ok').expect(200);
    expect(response.body).toEqual({ ok: true });
  });

  test('returns 503 while shutting down', async () => {
    const app = express();
    app.use((req, _res, next) => {
      req.requestId = 'req-shutdown-1';
      next();
    });
    app.use(createShutdownGate(() => true));
    app.get('/ok', (_req, res) => res.json({ ok: true }));

    const response = await request(app).get('/ok').expect(503);
    expect(response.body).toEqual({
      success: false,
      error: {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Server is restarting. Please retry in a few moments.',
        requestId: 'req-shutdown-1',
        correlationId: 'req-shutdown-1',
      },
    });
  });
});
