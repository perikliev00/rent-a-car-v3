const express = require('express');
const request = require('supertest');

jest.mock('../../src/monitoring/metrics', () => ({
  recordRequest: jest.fn(),
  incrementErrors: jest.fn(),
}));
jest.mock('../../src/monitoring/logEvent', () => ({
  warn: jest.fn(),
  info: jest.fn(),
}));

const metrics = require('../../src/monitoring/metrics');
const requestMetrics = require('../../src/middleware/requestMetrics');

describe('requestMetrics', () => {
  function createApp() {
    const app = express();
    app.use(requestMetrics);
    app.get('/api/test', (_req, res) => {
      res.status(200).json({ ok: true });
    });
    app.get('/health', (_req, res) => {
      res.status(200).send('ok');
    });
    return app;
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('records request metrics on response finish', async () => {
    const app = createApp();

    await request(app).get('/api/test').expect(200);

    expect(metrics.recordRequest).toHaveBeenCalledWith(
      'GET',
      '/api/test',
      200,
      expect.any(Number),
      expect.any(String)
    );
  });

  test('skips metrics for health probe paths', async () => {
    const app = createApp();

    await request(app).get('/health').expect(200);

    expect(metrics.recordRequest).not.toHaveBeenCalled();
  });
});
