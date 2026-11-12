// Require the 'express' module as express.
const express = require('express');
// Require the 'supertest' module as request.
const request = require('supertest');
// Require the '../src/monitoring/metrics' module as metrics.
const metrics = require('../src/monitoring/metrics');

// Create the original node env constant.
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
// Create the original metrics token constant.
const ORIGINAL_METRICS_TOKEN = process.env.METRICS_TOKEN;
// Create the original metrics allowed ips constant.
const ORIGINAL_METRICS_ALLOWED_IPS = process.env.METRICS_ALLOWED_IPS;

// Define the createMetricsApp function.
function createMetricsApp() {
  // Require the '../src/middleware/requireMetricsToken' module as requireMetricsToken.
  const requireMetricsToken = require('../src/middleware/requireMetricsToken');
  // Create the app constant.
  const app = express();
  // Call app.set to perform this step.
  app.set('trust proxy', 1);
  // Call app.get to perform this step.
  app.get('/metrics', requireMetricsToken, (_req, res) => {
    // Call res.json to perform this step.
    res.json(metrics.getSnapshot());
  });
  // Return the resulting value to the caller.
  return app;
}

// Declare a test suite grouping related cases.
describe('requireMetricsToken middleware', () => {
  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Update process.env.NODE_ENV with the right-hand side value.
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    // Update process.env.METRICS_TOKEN with the right-hand side value.
    process.env.METRICS_TOKEN = ORIGINAL_METRICS_TOKEN;
    // Update process.env.METRICS_ALLOWED_IPS with the right-hand side value.
    process.env.METRICS_ALLOWED_IPS = ORIGINAL_METRICS_ALLOWED_IPS;
    // Call jest.resetModules to perform this step.
    jest.resetModules();
  });

  // Define a single test case and its expectations.
  test('allows open access outside production', async () => {
    // Update process.env.NODE_ENV with the right-hand side value.
    process.env.NODE_ENV = 'development';
    // Delete the specified property from the object.
    delete process.env.METRICS_TOKEN;
    // Delete the specified property from the object.
    delete process.env.METRICS_ALLOWED_IPS;

    // Create the app constant.
    const app = createMetricsApp();
    // Create the response constant.
    const response = await request(app).get('/metrics');

    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(response.body).toHaveProperty('uptimeSeconds');
  });

  // Define a single test case and its expectations.
  test('returns 503 in production when metrics auth is not configured', async () => {
    // Update process.env.NODE_ENV with the right-hand side value.
    process.env.NODE_ENV = 'production';
    // Delete the specified property from the object.
    delete process.env.METRICS_TOKEN;
    // Delete the specified property from the object.
    delete process.env.METRICS_ALLOWED_IPS;

    // Create the app constant.
    const app = createMetricsApp();
    // Create the response constant.
    const response = await request(app).get('/metrics');

    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(503);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('METRICS_UNAVAILABLE');
  });

  // Define a single test case and its expectations.
  test('allows bearer token access in production', async () => {
    // Update process.env.NODE_ENV with the right-hand side value.
    process.env.NODE_ENV = 'production';
    // Update process.env.METRICS_TOKEN with the right-hand side value.
    process.env.METRICS_TOKEN = 'metrics-secret';
    // Delete the specified property from the object.
    delete process.env.METRICS_ALLOWED_IPS;

    // Create the app constant.
    const app = createMetricsApp();
    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/metrics')
      // Call .set to perform this step.
      .set('Authorization', 'Bearer metrics-secret');

    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
    // Assert that the value matches the intended expectation.
    expect(response.body).toHaveProperty('requests');
  });

  // Define a single test case and its expectations.
  test('allows x-metrics-token header access in production', async () => {
    // Update process.env.NODE_ENV with the right-hand side value.
    process.env.NODE_ENV = 'production';
    // Update process.env.METRICS_TOKEN with the right-hand side value.
    process.env.METRICS_TOKEN = 'metrics-secret';
    // Delete the specified property from the object.
    delete process.env.METRICS_ALLOWED_IPS;

    // Create the app constant.
    const app = createMetricsApp();
    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/metrics')
      // Call .set to perform this step.
      .set('X-Metrics-Token', 'metrics-secret');

    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
  });

  // Define a single test case and its expectations.
  test('rejects invalid token in production', async () => {
    // Update process.env.NODE_ENV with the right-hand side value.
    process.env.NODE_ENV = 'production';
    // Update process.env.METRICS_TOKEN with the right-hand side value.
    process.env.METRICS_TOKEN = 'metrics-secret';
    // Delete the specified property from the object.
    delete process.env.METRICS_ALLOWED_IPS;

    // Create the app constant.
    const app = createMetricsApp();
    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/metrics')
      // Call .set to perform this step.
      .set('Authorization', 'Bearer wrong-token');

    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(401);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  // Define a single test case and its expectations.
  test('allows allowlisted client IP in production', async () => {
    // Update process.env.NODE_ENV with the right-hand side value.
    process.env.NODE_ENV = 'production';
    // Delete the specified property from the object.
    delete process.env.METRICS_TOKEN;
    // Update process.env.METRICS_ALLOWED_IPS with the right-hand side value.
    process.env.METRICS_ALLOWED_IPS = '10.0.0.5';

    // Create the app constant.
    const app = createMetricsApp();
    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/metrics')
      // Call .set to perform this step.
      .set('X-Forwarded-For', '10.0.0.5');

    // Assert that the value matches the intended expectation.
    expect(response.status).toBe(200);
  });
});
