const { TooManyRequestsError } = require('../src/utils/appError');
const { buildErrorPayload } = require('../src/utils/httpResponse');
const { forwardControllerError } = require('../src/utils/controllerError');

describe('controllerError helpers', () => {
  test('forwardControllerError sets publicMessage and context', () => {
    const err = new Error('db down');
    const req = { correlationId: 'test-id' };
    const next = jest.fn();

    forwardControllerError(err, req, next, {
      context: 'getOrders',
      publicMessage: 'Error fetching orders.',
    });

    expect(next).toHaveBeenCalledWith(err);
    expect(err.publicMessage).toBe('Error fetching orders.');
    expect(err.controllerContext).toBe('getOrders');
  });

  test('respondJsonError returns standard payload', () => {
    const req = { correlationId: 'test-id' };
    const json = jest.fn();
    const res = {
      status: jest.fn(() => ({ json })),
    };

    const { respondJsonError } = require('../src/utils/controllerError');
    respondJsonError(res, req, { message: 'Failed.' });

    expect(res.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Failed.',
        requestId: 'test-id',
        correlationId: 'test-id',
      },
    });
  });
});

describe('TooManyRequestsError', () => {
  test('uses RATE_LIMITED code and 429 status', () => {
    const error = new TooManyRequestsError();
    expect(error.code).toBe('RATE_LIMITED');
    expect(error.status).toBe(429);
  });

  test('buildErrorPayload includes request and correlation id', () => {
    const error = new TooManyRequestsError();
    const payload = buildErrorPayload(error, { requestId: 'abc-123', correlationId: 'abc-123' });
    expect(payload.error.code).toBe('RATE_LIMITED');
    expect(payload.error.requestId).toBe('abc-123');
    expect(payload.error.correlationId).toBe('abc-123');
  });
});
