const express = require('express');
const request = require('supertest');
const metrics = require('../src/monitoring/metrics');

const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
const ORIGINAL_METRICS_TOKEN = process.env.METRICS_TOKEN;
const ORIGINAL_METRICS_ALLOWED_IPS = process.env.METRICS_ALLOWED_IPS;

function createMetricsApp() {
  const requireMetricsToken = require('../src/middleware/requireMetricsToken');
  const app = express();
  app.set('trust proxy', 1);
  app.get('/metrics', requireMetricsToken, (_req, res) => {
    res.json(metrics.getSnapshot());
  });
  return app;
}

describe('requireMetricsToken middleware', () => {
  afterEach(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    process.env.METRICS_TOKEN = ORIGINAL_METRICS_TOKEN;
    process.env.METRICS_ALLOWED_IPS = ORIGINAL_METRICS_ALLOWED_IPS;
    jest.resetModules();
  });

  test('allows open access outside production', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.METRICS_TOKEN;
    delete process.env.METRICS_ALLOWED_IPS;

    const app = createMetricsApp();
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('uptimeSeconds');
  });

  test('returns 503 in production when metrics auth is not configured', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.METRICS_TOKEN;
    delete process.env.METRICS_ALLOWED_IPS;

    const app = createMetricsApp();
    const response = await request(app).get('/metrics');

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('METRICS_UNAVAILABLE');
  });

  test('allows bearer token access in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 'metrics-secret';
    delete process.env.METRICS_ALLOWED_IPS;

    const app = createMetricsApp();
    const response = await request(app)
      .get('/metrics')
      .set('Authorization', 'Bearer metrics-secret');

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('requests');
  });

  test('allows x-metrics-token header access in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 'metrics-secret';
    delete process.env.METRICS_ALLOWED_IPS;

    const app = createMetricsApp();
    const response = await request(app)
      .get('/metrics')
      .set('X-Metrics-Token', 'metrics-secret');

    expect(response.status).toBe(200);
  });

  test('rejects invalid token in production', async () => {
    process.env.NODE_ENV = 'production';
    process.env.METRICS_TOKEN = 'metrics-secret';
    delete process.env.METRICS_ALLOWED_IPS;

    const app = createMetricsApp();
    const response = await request(app)
      .get('/metrics')
      .set('Authorization', 'Bearer wrong-token');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  test('allows allowlisted client IP in production', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.METRICS_TOKEN;
    process.env.METRICS_ALLOWED_IPS = '10.0.0.5';

    const app = createMetricsApp();
    const response = await request(app)
      .get('/metrics')
      .set('X-Forwarded-For', '10.0.0.5');

    expect(response.status).toBe(200);
  });
});
