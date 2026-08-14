const express = require('express');
const request = require('supertest');
const { AppError, ConflictError } = require('../../src/utils/appError');
const { handleNotFound, errorHandler } = require('../../src/middleware/errorHandler');

jest.mock('../../src/monitoring/metrics', () => ({
  incrementErrors: jest.fn(),
}));
jest.mock('../../src/config/sentry', () => ({
  captureException: jest.fn(),
}));

function createErrorApp(path = '/api/cars') {
  const app = express();
  app.get(path, (_req, _res, next) => next(new AppError('NOT_FOUND', 404, 'Car not found.')));
  app.get('/api/chat/test', (_req, _res, next) =>
    next(new ConflictError('Chat conflict.'))
  );
  app.get('/api/legacy', (_req, _res, next) => {
    const err = new Error('Legacy failure');
    err.publicMessage = 'Legacy public message';
    err.status = 400;
    err.code = 'LEGACY_CODE';
    next(err);
  });
  app.get('/api/overlap', (_req, _res, next) => next({ code: 'OVERLAP', message: 'overlap' }));
  app.get('/api/unique', (_req, _res, next) => {
    const err = new Error('unique');
    err.code = '23505';
    next(err);
  });
  app.get('/api/unknown', (_req, _res, next) => next(new Error('boom')));
  app.use(handleNotFound);
  app.use(errorHandler);
  return app;
}

describe('handleNotFound', () => {
  test('returns 404 for unknown routes', async () => {
    const app = createErrorApp();

    const response = await request(app).get('/api/missing').expect(404);

    expect(response.body).toEqual({
      success: false,
      error: expect.objectContaining({
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      }),
    });
  });
});

describe('errorHandler', () => {
  test('uses standard API envelope for /api/cars errors', async () => {
    const app = createErrorApp('/api/cars');

    const response = await request(app).get('/api/cars').expect(404);

    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.error.message).toBe('Car not found.');
  });

  test('uses chat error envelope for /api/chat routes', async () => {
    const app = createErrorApp();

    const response = await request(app).get('/api/chat/test').expect(409);

    expect(response.body.success).toBeUndefined();
    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toBe('Chat conflict.');
  });

  test('normalizes legacy errors with publicMessage', async () => {
    const app = createErrorApp();

    const response = await request(app).get('/api/legacy').expect(400);

    expect(response.body.error.code).toBe('LEGACY_CODE');
    expect(response.body.error.message).toBe('Legacy public message');
  });

  test('normalizes OVERLAP code to conflict', async () => {
    const app = createErrorApp();

    const response = await request(app).get('/api/overlap').expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  test('normalizes unknown errors to internal server error', async () => {
    const app = createErrorApp();

    const response = await request(app).get('/api/unknown').expect(500);

    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });
});
