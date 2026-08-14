import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, apiFormData, setCsrfToken } from './client';

function jsonResponse(data: unknown, status = 200) {
  return {
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    text: async () => JSON.stringify(data),
  };
}

describe('ApiError', () => {
  it('stores code, message, and status', () => {
    const error = new ApiError('UNAUTHORIZED', 'Please log in', 401);
    expect(error.name).toBe('ApiError');
    expect(error.code).toBe('UNAUTHORIZED');
    expect(error.message).toBe('Please log in');
    expect(error.status).toBe(401);
  });
});

describe('api', () => {
  beforeEach(() => {
    setCsrfToken(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns data from successful JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { id: '1' } })),
    );

    await expect(api<{ id: string }>('/cars/1')).resolves.toEqual({ id: '1' });
  });

  it('throws ApiError for API error responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            success: false,
            error: { code: 'UNAUTHORIZED', message: 'Please log in again.' },
          },
          401,
        ),
      ),
    );

    await expect(api('/auth/me')).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
      message: 'Please log in again.',
      status: 401,
    });
  });

  it('throws ApiError on network failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    await expect(api('/cars')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  it('throws ApiError for empty responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 500,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '',
      }),
    );

    await expect(api('/cars')).rejects.toBeInstanceOf(ApiError);
  });

  it('fetches CSRF token on first mutating request', async () => {
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.endsWith('/api/v1/auth/csrf')) {
        return jsonResponse({ success: true, data: { csrfToken: 'fresh-token' } });
      }
      return jsonResponse({ success: true, data: { ok: true } });
    });
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/test', { method: 'POST', body: JSON.stringify({}) });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/auth\/csrf$/);
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/api\/v1\/test$/);
    const postHeaders = new Headers(fetchMock.mock.calls[1][1]?.headers as HeadersInit);
    expect(postHeaders.get('X-CSRF-Token')).toBe('fresh-token');
  });

  it('attaches X-CSRF-Token header when token is cached', async () => {
    setCsrfToken('cached-token');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/test', { method: 'POST', body: JSON.stringify({}) });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers as HeadersInit);
    expect(headers.get('X-CSRF-Token')).toBe('cached-token');
  });

  it('refetches CSRF token on CSRF_INVALID without retrying the request', async () => {
    setCsrfToken('stale-token');
    let postCount = 0;
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (urlStr.endsWith('/api/v1/auth/csrf')) {
        return jsonResponse({ success: true, data: { csrfToken: 'new-token' } });
      }
      postCount += 1;
      return jsonResponse(
        {
          success: false,
          error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' },
        },
        403,
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api('/api/test', { method: 'POST', body: JSON.stringify({}) })).rejects.toMatchObject({
      code: 'CSRF_INVALID',
      status: 403,
    });

    expect(postCount).toBe(1);
    expect(fetchMock.mock.calls.some((call) => String(call[0]).endsWith('/api/v1/auth/csrf'))).toBe(true);
  });

  it('throws INVALID_JSON for malformed JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        text: async () => '{not json',
      }),
    );

    await expect(api('/cars')).rejects.toMatchObject({ code: 'INVALID_JSON' });
  });

  it('throws INVALID_CONTENT_TYPE for non-JSON responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        text: async () => '<html></html>',
      }),
    );

    await expect(api('/cars')).rejects.toMatchObject({ code: 'INVALID_CONTENT_TYPE' });
  });

  it('throws INVALID_RESPONSE when body lacks success field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(jsonResponse({ foo: 'bar' })),
    );

    await expect(api('/cars')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });

  it('setCsrfToken updates the token used on mutating requests', async () => {
    setCsrfToken('manual-token');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await api('/api/test', { method: 'PATCH', body: JSON.stringify({}) });

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers as HeadersInit);
    expect(headers.get('X-CSRF-Token')).toBe('manual-token');
  });
});

describe('apiFormData', () => {
  beforeEach(() => {
    setCsrfToken('form-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not set Content-Type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    const formData = new FormData();
    formData.append('name', 'test');
    await apiFormData('/api/upload', formData);

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers as HeadersInit);
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('still attaches X-CSRF-Token on mutating requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFormData('/api/upload', new FormData(), 'PUT');

    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers as HeadersInit);
    expect(headers.get('X-CSRF-Token')).toBe('form-token');
  });
});
