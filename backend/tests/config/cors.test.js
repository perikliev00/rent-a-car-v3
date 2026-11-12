const express = require('express');
const request = require('supertest');
const {
  parseCorsOrigins,
  getAllowedOrigins,
  createCorsMiddleware,
  DEFAULT_DEV_ORIGINS,
} = require('../../src/config/cors');

describe('cors config', () => {
  test('parseCorsOrigins splits comma-separated values', () => {
    expect(parseCorsOrigins('http://localhost:5173, http://localhost:3001')).toEqual([
      'http://localhost:5173',
      'http://localhost:3001',
    ]);
  });

  test('getAllowedOrigins uses env origins when configured', () => {
    expect(
      getAllowedOrigins({
        isProd: false,
        corsOrigins: ['https://app.example.com'],
      })
    ).toEqual(['https://app.example.com']);
  });

  test('getAllowedOrigins falls back to dev defaults outside production', () => {
    expect(
      getAllowedOrigins({
        isProd: false,
        corsOrigins: [],
      })
    ).toEqual(DEFAULT_DEV_ORIGINS);
  });

  test('getAllowedOrigins is empty in production without explicit origins', () => {
    expect(
      getAllowedOrigins({
        isProd: true,
        corsOrigins: [],
      })
    ).toEqual([]);
  });
});

describe('cors middleware', () => {
  function createCorsTestApp(origins) {
    const app = express();
    const middleware = createCorsMiddleware({
      isProd: false,
      corsOrigins: origins,
    });
    app.use(middleware);
    app.get('/api/ping', (_req, res) => {
      res.json({ ok: true });
    });
    return app;
  }

  test('allows configured origin with credentials', async () => {
    const app = createCorsTestApp(['http://localhost:5173']);

    const response = await request(app)
      .get('/api/ping')
      .set('Origin', 'http://localhost:5173')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  test('answers preflight for allowed origin', async () => {
    const app = createCorsTestApp(['http://localhost:5173']);

    const response = await request(app)
      .options('/api/ping')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204);

    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  test('does not reflect disallowed origin', async () => {
    const app = createCorsTestApp(['http://localhost:5173']);

    const response = await request(app)
      .get('/api/ping')
      .set('Origin', 'http://evil.example.com')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('allows X-CSRF-Token header in preflight', async () => {
    const app = createCorsTestApp(['http://localhost:5173']);

    const response = await request(app)
      .options('/api/ping')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'X-CSRF-Token')
      .expect(204);

    expect(response.headers['access-control-allow-headers']).toContain('X-CSRF-Token');
  });
});
