// Destructure object properties into local variables.
const { TooManyRequestsError } = require('../src/utils/appError');
// Destructure object properties into local variables.
const { buildErrorPayload } = require('../src/utils/httpResponse');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../src/utils/controllerError');

// Declare a test suite grouping related cases.
describe('controllerError helpers', () => {
  // Define a single test case and its expectations.
  test('forwardControllerError sets publicMessage and context', () => {
    // Create the err constant.
    const err = new Error('db down');
    // Create the req constant.
    const req = { correlationId: 'test-id' };
    // Create the next constant.
    const next = jest.fn();

    // Call forwardControllerError to perform this step.
    forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'getOrders',
      // Provide the public message field value.
      publicMessage: 'Error fetching orders.',
    });

    // Assert that the value matches the intended expectation.
    expect(next).toHaveBeenCalledWith(err);
    // Assert that the value matches the intended expectation.
    expect(err.publicMessage).toBe('Error fetching orders.');
    // Assert that the value matches the intended expectation.
    expect(err.controllerContext).toBe('getOrders');
  });

  // Define a single test case and its expectations.
  test('respondJsonError returns standard payload', () => {
    // Create the req constant.
    const req = { correlationId: 'test-id' };
    // Create the json constant.
    const json = jest.fn();
    // Create the res constant.
    const res = {
      // Provide the status field value.
      status: jest.fn(() => ({ json })),
    };

    // Destructure object properties into local variables.
    const { respondJsonError } = require('../src/utils/controllerError');
    // Call respondJsonError to perform this step.
    respondJsonError(res, req, { message: 'Failed.' });

    // Assert that the value matches the intended expectation.
    expect(res.status).toHaveBeenCalledWith(500);
    // Assert that the value matches the intended expectation.
    expect(json).toHaveBeenCalledWith({
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'INTERNAL_ERROR',
        // Provide the message field value.
        message: 'Failed.',
        // Provide the request id field value.
        requestId: 'test-id',
        // Provide the correlation id field value.
        correlationId: 'test-id',
      },
    });
  });
});

// Declare a test suite grouping related cases.
describe('TooManyRequestsError', () => {
  // Define a single test case and its expectations.
  test('uses RATE_LIMITED code and 429 status', () => {
    // Create the error constant.
    const error = new TooManyRequestsError();
    // Assert that the value matches the intended expectation.
    expect(error.code).toBe('RATE_LIMITED');
    // Assert that the value matches the intended expectation.
    expect(error.status).toBe(429);
  });

  // Define a single test case and its expectations.
  test('buildErrorPayload includes request and correlation id', () => {
    // Create the error constant.
    const error = new TooManyRequestsError();
    // Create the payload constant.
    const payload = buildErrorPayload(error, { requestId: 'abc-123', correlationId: 'abc-123' });
    // Assert that the value matches the intended expectation.
    expect(payload.error.code).toBe('RATE_LIMITED');
    // Assert that the value matches the intended expectation.
    expect(payload.error.requestId).toBe('abc-123');
    // Assert that the value matches the intended expectation.
    expect(payload.error.correlationId).toBe('abc-123');
  });
});
