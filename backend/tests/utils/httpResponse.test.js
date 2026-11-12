const {
  buildErrorPayload,
  getRequestIdFromReq,
  wantsJson,
} = require('../../src/utils/httpResponse');

describe('getRequestIdFromReq', () => {
  test('prefers requestId over correlationId', () => {
    expect(getRequestIdFromReq({ requestId: 'req-1', correlationId: 'corr-1' })).toBe('req-1');
  });

  test('falls back to correlationId', () => {
    expect(getRequestIdFromReq({ correlationId: 'corr-2' })).toBe('corr-2');
  });

  test('returns null when neither is set', () => {
    expect(getRequestIdFromReq({})).toBeNull();
  });
});

describe('buildErrorPayload', () => {
  test('includes code, message, and request ids', () => {
    const payload = buildErrorPayload(
      { code: 'NOT_FOUND', message: 'Missing' },
      { requestId: 'abc-123' }
    );

    expect(payload).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Missing',
        requestId: 'abc-123',
        correlationId: 'abc-123',
      },
    });
  });
});

describe('wantsJson', () => {
  test('returns true for API paths', () => {
    expect(wantsJson({ path: '/api/cars', get: () => '' })).toBe(true);
  });

  test('returns true for stripe webhook', () => {
    expect(wantsJson({ path: '/webhook/stripe', get: () => '' })).toBe(true);
  });

  test('returns false for HTML accept on non-API paths', () => {
    expect(
      wantsJson({
        path: '/',
        xhr: false,
        get: () => 'text/html,application/json',
      })
    ).toBe(false);
  });
});
