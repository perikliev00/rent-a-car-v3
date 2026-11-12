// Require the 'express' module as express.
const express = require('express');
// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  parseCorsOrigins,
  // Contribute this line to the enclosing declaration or statement.
  getAllowedOrigins,
  // Contribute this line to the enclosing declaration or statement.
  createCorsMiddleware,
  // Contribute this line to the enclosing declaration or statement.
  DEFAULT_DEV_ORIGINS,
// Continue the surrounding logic with this statement.
} = require('../../src/config/cors');

// Declare a test suite grouping related cases.
describe('cors config', () => {
  // Define a single test case and its expectations.
  test('parseCorsOrigins splits comma-separated values', () => {
    // Assert that the value matches the intended expectation.
    expect(parseCorsOrigins('http://localhost:5173, http://localhost:3001')).toEqual([
      // Supply the literal value used by the enclosing expression.
      'http://localhost:5173',
      // Supply the literal value used by the enclosing expression.
      'http://localhost:3001',
    ]);
  });

  // Define a single test case and its expectations.
  test('getAllowedOrigins uses env origins when configured', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call getAllowedOrigins to perform this step.
      getAllowedOrigins({
        // Provide the is prod field value.
        isProd: false,
        // Provide the cors origins field value.
        corsOrigins: ['https://app.example.com'],
      })
    // Continue the surrounding logic with this statement.
    ).toEqual(['https://app.example.com']);
  });

  // Define a single test case and its expectations.
  test('getAllowedOrigins falls back to dev defaults outside production', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call getAllowedOrigins to perform this step.
      getAllowedOrigins({
        // Provide the is prod field value.
        isProd: false,
        // Provide the cors origins field value.
        corsOrigins: [],
      })
    // Continue the surrounding logic with this statement.
    ).toEqual(DEFAULT_DEV_ORIGINS);
  });

  // Define a single test case and its expectations.
  test('getAllowedOrigins is empty in production without explicit origins', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call getAllowedOrigins to perform this step.
      getAllowedOrigins({
        // Provide the is prod field value.
        isProd: true,
        // Provide the cors origins field value.
        corsOrigins: [],
      })
    // Continue the surrounding logic with this statement.
    ).toEqual([]);
  });
});

// Declare a test suite grouping related cases.
describe('cors middleware', () => {
  // Define the createCorsTestApp function.
  function createCorsTestApp(origins) {
    // Create the app constant.
    const app = express();
    // Create the middleware constant.
    const middleware = createCorsMiddleware({
      // Provide the is prod field value.
      isProd: false,
      // Provide the cors origins field value.
      corsOrigins: origins,
    });
    // Call app.use to perform this step.
    app.use(middleware);
    // Call app.get to perform this step.
    app.get('/api/ping', (_req, res) => {
      // Call res.json to perform this step.
      res.json({ ok: true });
    });
    // Return the resulting value to the caller.
    return app;
  }

  // Define a single test case and its expectations.
  test('allows configured origin with credentials', async () => {
    // Create the app constant.
    const app = createCorsTestApp(['http://localhost:5173']);

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/ping')
      // Call .set to perform this step.
      .set('Origin', 'http://localhost:5173')
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    // Assert that the value matches the intended expectation.
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  // Define a single test case and its expectations.
  test('answers preflight for allowed origin', async () => {
    // Create the app constant.
    const app = createCorsTestApp(['http://localhost:5173']);

    // Create the response constant.
    const response = await request(app)
      // Call .options to perform this step.
      .options('/api/ping')
      // Call .set to perform this step.
      .set('Origin', 'http://localhost:5173')
      // Call .set to perform this step.
      .set('Access-Control-Request-Method', 'POST')
      // Call .expect to perform this step.
      .expect(204);

    // Assert that the value matches the intended expectation.
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    // Assert that the value matches the intended expectation.
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    // Assert that the value matches the intended expectation.
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  // Define a single test case and its expectations.
  test('does not reflect disallowed origin', async () => {
    // Create the app constant.
    const app = createCorsTestApp(['http://localhost:5173']);

    // Create the response constant.
    const response = await request(app)
      // Call .get to perform this step.
      .get('/api/ping')
      // Call .set to perform this step.
      .set('Origin', 'http://evil.example.com')
      // Call .expect to perform this step.
      .expect(200);

    // Assert that the value matches the intended expectation.
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  // Define a single test case and its expectations.
  test('allows X-CSRF-Token header in preflight', async () => {
    // Create the app constant.
    const app = createCorsTestApp(['http://localhost:5173']);

    // Create the response constant.
    const response = await request(app)
      // Call .options to perform this step.
      .options('/api/ping')
      // Call .set to perform this step.
      .set('Origin', 'http://localhost:5173')
      // Call .set to perform this step.
      .set('Access-Control-Request-Method', 'POST')
      // Call .set to perform this step.
      .set('Access-Control-Request-Headers', 'X-CSRF-Token')
      // Call .expect to perform this step.
      .expect(204);

    // Assert that the value matches the intended expectation.
    expect(response.headers['access-control-allow-headers']).toContain('X-CSRF-Token');
  });
});
