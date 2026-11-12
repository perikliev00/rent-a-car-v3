// Require the 'express' module as express.
const express = require('express');
// Require the 'supertest' module as request.
const request = require('supertest');

// Call jest.mock to perform this step.
jest.mock('../../src/monitoring/metrics', () => ({
  // Provide the increment errors field value.
  incrementErrors: jest.fn(),
  // Provide the increment reservation conflict field value.
  incrementReservationConflict: jest.fn(),
}));
// Call jest.mock to perform this step.
jest.mock('../../src/config/sentry', () => ({
  // Provide the capture exception field value.
  captureException: jest.fn(),
}));

// Require the '../../src/monitoring/metrics' module as metrics.
const metrics = require('../../src/monitoring/metrics');
// Destructure object properties into local variables.
const { AppError, ConflictError } = require('../../src/utils/appError');
// Destructure object properties into local variables.
const { handleNotFound, errorHandler } = require('../../src/middleware/errorHandler');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  RESERVATION_HOLD_OVERLAP_CONSTRAINT,
  // Contribute this line to the enclosing declaration or statement.
  CAR_DATE_BLOCKS_OVERLAP_CONSTRAINT,
// Continue the surrounding logic with this statement.
} = require('../../src/db/transaction');

// Define the createErrorApp function.
function createErrorApp(path = '/api/cars') {
  // Create the app constant.
  const app = express();
  // Call app.get to perform this step.
  app.get(path, (_req, _res, next) => next(new AppError('NOT_FOUND', 404, 'Car not found.')));
  // Call app.get to perform this step.
  app.get('/api/chat/test', (_req, _res, next) =>
    // Call next to perform this step.
    next(new ConflictError('Chat conflict.'))
  );
  // Call app.get to perform this step.
  app.get('/api/legacy', (_req, _res, next) => {
    // Create the err constant.
    const err = new Error('Legacy failure');
    // Update err.publicMessage with the right-hand side value.
    err.publicMessage = 'Legacy public message';
    // Update err.status with the right-hand side value.
    err.status = 400;
    // Update err.code with the right-hand side value.
    err.code = 'LEGACY_CODE';
    // Call next to perform this step.
    next(err);
  });
  // Call app.get to perform this step.
  app.get('/api/overlap', (_req, _res, next) => next({ code: 'OVERLAP', message: 'overlap' }));
  // Call app.get to perform this step.
  app.get('/api/hold-overlap', (_req, _res, next) => {
    // Create the err constant.
    const err = new Error('hold overlap');
    // Update err.code with the right-hand side value.
    err.code = '23P01';
    // Update err.constraint with the right-hand side value.
    err.constraint = RESERVATION_HOLD_OVERLAP_CONSTRAINT;
    // Call next to perform this step.
    next(err);
  });
  // Call app.get to perform this step.
  app.get('/api/block-overlap', (_req, _res, next) => {
    // Create the err constant.
    const err = new Error('block overlap');
    // Update err.code with the right-hand side value.
    err.code = '23P01';
    // Update err.constraint with the right-hand side value.
    err.constraint = CAR_DATE_BLOCKS_OVERLAP_CONSTRAINT;
    // Call next to perform this step.
    next(err);
  });
  // Call app.get to perform this step.
  app.get('/api/unique', (_req, _res, next) => {
    // Create the err constant.
    const err = new Error('unique');
    // Update err.code with the right-hand side value.
    err.code = '23505';
    // Call next to perform this step.
    next(err);
  });
  // Call app.get to perform this step.
  app.get('/api/unknown', (_req, _res, next) => next(new Error('boom')));
  // Call app.use to perform this step.
  app.use(handleNotFound);
  // Call app.use to perform this step.
  app.use(errorHandler);
  // Return the resulting value to the caller.
  return app;
}

// Declare a test suite grouping related cases.
describe('handleNotFound', () => {
  // Define a single test case and its expectations.
  test('returns 404 for unknown routes', async () => {
    // Create the app constant.
    const app = createErrorApp();

    // Create the response constant.
    const response = await request(app).get('/api/missing').expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body).toEqual({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: expect.objectContaining({
        // Provide the code field value.
        code: 'NOT_FOUND',
        // Provide the message field value.
        message: 'The requested resource was not found.',
      }),
    });
  });
});

// Declare a test suite grouping related cases.
describe('errorHandler', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call jest.clearAllMocks to perform this step.
    jest.clearAllMocks();
  });

  // Define a single test case and its expectations.
  test('uses standard API envelope for /api/cars errors', async () => {
    // Create the app constant.
    const app = createErrorApp('/api/cars');

    // Create the response constant.
    const response = await request(app).get('/api/cars').expect(404);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('NOT_FOUND');
    // Assert that the value matches the intended expectation.
    expect(response.body.error.message).toBe('Car not found.');
  });

  // Define a single test case and its expectations.
  test('uses chat error envelope for /api/chat routes', async () => {
    // Create the app constant.
    const app = createErrorApp();

    // Create the response constant.
    const response = await request(app).get('/api/chat/test').expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.success).toBeUndefined();
    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('CONFLICT');
    // Assert that the value matches the intended expectation.
    expect(response.body.error.message).toBe('Chat conflict.');
    // Assert that the value matches the intended expectation.
    expect(metrics.incrementReservationConflict).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('normalizes legacy errors with publicMessage', async () => {
    // Create the app constant.
    const app = createErrorApp();

    // Create the response constant.
    const response = await request(app).get('/api/legacy').expect(400);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('LEGACY_CODE');
    // Assert that the value matches the intended expectation.
    expect(response.body.error.message).toBe('Legacy public message');
  });

  // Define a single test case and its expectations.
  test('normalizes OVERLAP code to conflict and tracks booking conflict', async () => {
    // Create the app constant.
    const app = createErrorApp();

    // Create the response constant.
    const response = await request(app).get('/api/overlap').expect(409);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('CONFLICT');
    // Assert that the value matches the intended expectation.
    expect(metrics.incrementReservationConflict).toHaveBeenCalledWith('overlap');
  });

  // Define a single test case and its expectations.
  test('tracks hold and car-block overlaps', async () => {
    // Create the app constant.
    const app = createErrorApp();

    // Wait until the asynchronous operation resolves.
    await request(app).get('/api/hold-overlap').expect(409);
    // Wait until the asynchronous operation resolves.
    await request(app).get('/api/block-overlap').expect(409);

    // Assert that the value matches the intended expectation.
    expect(metrics.incrementReservationConflict).toHaveBeenCalledWith('hold_overlap');
    // Assert that the value matches the intended expectation.
    expect(metrics.incrementReservationConflict).toHaveBeenCalledWith('car_block_overlap');
  });

  // Define a single test case and its expectations.
  test('does not track generic unique violations as booking conflicts', async () => {
    // Create the app constant.
    const app = createErrorApp();

    // Wait until the asynchronous operation resolves.
    await request(app).get('/api/unique').expect(409);

    // Assert that the value matches the intended expectation.
    expect(metrics.incrementReservationConflict).not.toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  test('normalizes unknown errors to internal server error', async () => {
    // Create the app constant.
    const app = createErrorApp();

    // Create the response constant.
    const response = await request(app).get('/api/unknown').expect(500);

    // Assert that the value matches the intended expectation.
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });
});
