const {
  buildErrorPayload,
  getRequestIdFromReq,
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
