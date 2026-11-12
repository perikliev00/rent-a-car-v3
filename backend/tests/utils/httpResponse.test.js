// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  buildErrorPayload,
  // Contribute this line to the enclosing declaration or statement.
  getRequestIdFromReq,
  // Contribute this line to the enclosing declaration or statement.
  wantsJson,
// Continue the surrounding logic with this statement.
} = require('../../src/utils/httpResponse');

// Declare a test suite grouping related cases.
describe('getRequestIdFromReq', () => {
  // Define a single test case and its expectations.
  test('prefers requestId over correlationId', () => {
    // Assert that the value matches the intended expectation.
    expect(getRequestIdFromReq({ requestId: 'req-1', correlationId: 'corr-1' })).toBe('req-1');
  });

  // Define a single test case and its expectations.
  test('falls back to correlationId', () => {
    // Assert that the value matches the intended expectation.
    expect(getRequestIdFromReq({ correlationId: 'corr-2' })).toBe('corr-2');
  });

  // Define a single test case and its expectations.
  test('returns null when neither is set', () => {
    // Assert that the value matches the intended expectation.
    expect(getRequestIdFromReq({})).toBeNull();
  });
});

// Declare a test suite grouping related cases.
describe('buildErrorPayload', () => {
  // Define a single test case and its expectations.
  test('includes code, message, and request ids', () => {
    // Create the payload constant.
    const payload = buildErrorPayload(
      // Contribute this line to the enclosing declaration or statement.
      { code: 'NOT_FOUND', message: 'Missing' },
      // Contribute this line to the enclosing declaration or statement.
      { requestId: 'abc-123' }
    );

    // Assert that the value matches the intended expectation.
    expect(payload).toEqual({
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'NOT_FOUND',
        // Provide the message field value.
        message: 'Missing',
        // Provide the request id field value.
        requestId: 'abc-123',
        // Provide the correlation id field value.
        correlationId: 'abc-123',
      },
    });
  });
});

// Declare a test suite grouping related cases.
describe('wantsJson', () => {
  // Define a single test case and its expectations.
  test('returns true for API paths', () => {
    // Assert that the value matches the intended expectation.
    expect(wantsJson({ path: '/api/cars', get: () => '' })).toBe(true);
  });

  // Define a single test case and its expectations.
  test('returns true for stripe webhook', () => {
    // Assert that the value matches the intended expectation.
    expect(wantsJson({ path: '/webhook/stripe', get: () => '' })).toBe(true);
  });

  // Define a single test case and its expectations.
  test('returns false for HTML accept on non-API paths', () => {
    // Assert that the value matches the intended expectation.
    expect(
      // Call wantsJson to perform this step.
      wantsJson({
        // Provide the path field value.
        path: '/',
        // Provide the xhr field value.
        xhr: false,
        // Provide the get field value.
        get: () => 'text/html,application/json',
      })
    // Continue the surrounding logic with this statement.
    ).toBe(false);
  });
});
