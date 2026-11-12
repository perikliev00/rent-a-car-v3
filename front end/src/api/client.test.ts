// Import named exports from 'vitest'.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from './client'.
import { ApiError, api, apiFormData, setCsrfToken } from './client';

// Define the jsonResponse function.
function jsonResponse(data: unknown, status = 200) {
  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    status,
    // Provide the headers field value.
    headers: new Headers({ 'content-type': 'application/json' }),
    // Provide the text field value.
    text: async () => JSON.stringify(data),
  };
}

// Declare a test suite grouping related cases.
describe('ApiError', () => {
  // Define a single test case and its expectations.
  it('stores code, message, and status', () => {
    // Create the error constant.
    const error = new ApiError('UNAUTHORIZED', 'Please log in', 401);
    // Assert that the value matches the intended expectation.
    expect(error.name).toBe('ApiError');
    // Assert that the value matches the intended expectation.
    expect(error.code).toBe('UNAUTHORIZED');
    // Assert that the value matches the intended expectation.
    expect(error.message).toBe('Please log in');
    // Assert that the value matches the intended expectation.
    expect(error.status).toBe(401);
  });
});

// Declare a test suite grouping related cases.
describe('api', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call setCsrfToken to perform this step.
    setCsrfToken(null);
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call vi.unstubAllGlobals to perform this step.
    vi.unstubAllGlobals();
  });

  // Define a single test case and its expectations.
  it('returns data from successful JSON responses', async () => {
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal(
      // Supply the literal value used by the enclosing expression.
      'fetch',
      // Call vi.fn to perform this step.
      vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { id: '1' } })),
    );

    // Wait until the asynchronous operation resolves.
    await expect(api<{ id: string }>('/cars/1')).resolves.toEqual({ id: '1' });
  });

  // Define a single test case and its expectations.
  it('throws ApiError for API error responses', async () => {
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal(
      // Supply the literal value used by the enclosing expression.
      'fetch',
      // Call vi.fn to perform this step.
      vi.fn().mockResolvedValue(
        // Call jsonResponse to perform this step.
        jsonResponse(
          {
            // Provide the success field value.
            success: false,
            // Provide the error field value.
            error: { code: 'UNAUTHORIZED', message: 'Please log in again.' },
          },
          // Supply the literal value used by the enclosing expression.
          401,
        ),
      ),
    );

    // Wait until the asynchronous operation resolves.
    await expect(api('/auth/me')).rejects.toMatchObject({
      // Provide the code field value.
      code: 'UNAUTHORIZED',
      // Provide the message field value.
      message: 'Please log in again.',
      // Provide the status field value.
      status: 401,
    });
  });

  // Define a single test case and its expectations.
  it('throws ApiError on network failures', async () => {
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    // Wait until the asynchronous operation resolves.
    await expect(api('/cars')).rejects.toMatchObject({
      // Provide the code field value.
      code: 'NETWORK_ERROR',
      // Provide the status field value.
      status: 0,
    });
  });

  // Define a single test case and its expectations.
  it('throws ApiError for empty responses', async () => {
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal(
      // Supply the literal value used by the enclosing expression.
      'fetch',
      // Call vi.fn to perform this step.
      vi.fn().mockResolvedValue({
        // Provide the status field value.
        status: 500,
        // Provide the headers field value.
        headers: new Headers({ 'content-type': 'application/json' }),
        // Provide the text field value.
        text: async () => '',
      }),
    );

    // Wait until the asynchronous operation resolves.
    await expect(api('/cars')).rejects.toBeInstanceOf(ApiError);
  });

  // Define a single test case and its expectations.
  it('fetches CSRF token on first mutating request', async () => {
    // Create the fetch mock constant.
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      // Create the url str constant.
      const urlStr = typeof url === 'string' ? url : url.toString();
      // Evaluate the condition and enter the branch when it is true.
      if (urlStr.endsWith('/api/v1/auth/csrf')) {
        // Return the resulting value to the caller.
        return jsonResponse({ success: true, data: { csrfToken: 'fresh-token' } });
      }
      // Return the resulting value to the caller.
      return jsonResponse({ success: true, data: { ok: true } });
    });
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal('fetch', fetchMock);

    // Wait until the asynchronous operation resolves.
    await api('/api/test', { method: 'POST', body: JSON.stringify({}) });

    // Assert that the value matches the intended expectation.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    // Assert that the value matches the intended expectation.
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/\/api\/v1\/auth\/csrf$/);
    // Assert that the value matches the intended expectation.
    expect(String(fetchMock.mock.calls[1][0])).toMatch(/\/api\/v1\/test$/);
    // Create the post headers constant.
    const postHeaders = new Headers(fetchMock.mock.calls[1][1]?.headers as HeadersInit);
    // Assert that the value matches the intended expectation.
    expect(postHeaders.get('X-CSRF-Token')).toBe('fresh-token');
  });

  // Define a single test case and its expectations.
  it('attaches X-CSRF-Token header when token is cached', async () => {
    // Call setCsrfToken to perform this step.
    setCsrfToken('cached-token');
    // Create the fetch mock constant.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }));
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal('fetch', fetchMock);

    // Wait until the asynchronous operation resolves.
    await api('/api/test', { method: 'POST', body: JSON.stringify({}) });

    // Assert that the value matches the intended expectation.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    // Create the headers constant.
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers as HeadersInit);
    // Assert that the value matches the intended expectation.
    expect(headers.get('X-CSRF-Token')).toBe('cached-token');
  });

  // Define a single test case and its expectations.
  it('retries a mutating request once after CSRF_INVALID', async () => {
    // Call setCsrfToken to perform this step.
    setCsrfToken('stale-token');
    // Continue the surrounding logic with this statement.
    const postTokens: Array<string | null> = [];
    // Create the fetch mock constant.
    const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
      // Create the url str constant.
      const urlStr = typeof url === 'string' ? url : url.toString();
      // Evaluate the condition and enter the branch when it is true.
      if (urlStr.endsWith('/api/v1/auth/csrf')) {
        // Return the resulting value to the caller.
        return jsonResponse({ success: true, data: { csrfToken: 'new-token' } });
      }
      // Create the headers constant.
      const headers = new Headers(init?.headers);
      // Call postTokens.push to perform this step.
      postTokens.push(headers.get('X-CSRF-Token'));
      // Evaluate the condition and enter the branch when it is true.
      if (headers.get('X-CSRF-Token') === 'stale-token') {
        // Return the resulting value to the caller.
        return jsonResponse(
          {
            // Provide the success field value.
            success: false,
            // Provide the error field value.
            error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' },
          },
          // Supply the literal value used by the enclosing expression.
          403,
        );
      }
      // Return the resulting value to the caller.
      return jsonResponse({ success: true, data: { ok: true } });
    });
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal('fetch', fetchMock);

    // Wait until the asynchronous operation resolves.
    await expect(api('/api/test', { method: 'POST', body: JSON.stringify({}) })).resolves.toEqual({
      // Provide the ok field value.
      ok: true,
    });

    // Assert that the value matches the intended expectation.
    expect(postTokens).toEqual(['stale-token', 'new-token']);
  });

  // Define a single test case and its expectations.
  it('does not retry CSRF_INVALID more than once', async () => {
    // Call setCsrfToken to perform this step.
    setCsrfToken('stale-token');
    // Initialize the mutable post count variable.
    let postCount = 0;
    // Create the fetch mock constant.
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      // Create the url str constant.
      const urlStr = typeof url === 'string' ? url : url.toString();
      // Evaluate the condition and enter the branch when it is true.
      if (urlStr.endsWith('/api/v1/auth/csrf')) {
        // Return the resulting value to the caller.
        return jsonResponse({ success: true, data: { csrfToken: 'new-token' } });
      }
      // Update postCount with the right-hand side value.
      postCount += 1;
      // Return the resulting value to the caller.
      return jsonResponse(
        {
          // Provide the success field value.
          success: false,
          // Provide the error field value.
          error: { code: 'CSRF_INVALID', message: 'Invalid CSRF token' },
        },
        // Supply the literal value used by the enclosing expression.
        403,
      );
    });
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal('fetch', fetchMock);

    // Wait until the asynchronous operation resolves.
    await expect(api('/api/test', { method: 'POST', body: JSON.stringify({}) })).rejects.toMatchObject({
      // Provide the code field value.
      code: 'CSRF_INVALID',
      // Provide the status field value.
      status: 403,
    });

    // Assert that the value matches the intended expectation.
    expect(postCount).toBe(2);
  });

  // Define a single test case and its expectations.
  it('throws INVALID_JSON for malformed JSON', async () => {
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal(
      // Supply the literal value used by the enclosing expression.
      'fetch',
      // Call vi.fn to perform this step.
      vi.fn().mockResolvedValue({
        // Provide the status field value.
        status: 200,
        // Provide the headers field value.
        headers: new Headers({ 'content-type': 'application/json' }),
        // Provide the text field value.
        text: async () => '{not json',
      }),
    );

    // Wait until the asynchronous operation resolves.
    await expect(api('/cars')).rejects.toMatchObject({ code: 'INVALID_JSON' });
  });

  // Define a single test case and its expectations.
  it('throws INVALID_CONTENT_TYPE for non-JSON responses', async () => {
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal(
      // Supply the literal value used by the enclosing expression.
      'fetch',
      // Call vi.fn to perform this step.
      vi.fn().mockResolvedValue({
        // Provide the status field value.
        status: 200,
        // Provide the headers field value.
        headers: new Headers({ 'content-type': 'text/html' }),
        // Provide the text field value.
        text: async () => '<html></html>',
      }),
    );

    // Wait until the asynchronous operation resolves.
    await expect(api('/cars')).rejects.toMatchObject({ code: 'INVALID_CONTENT_TYPE' });
  });

  // Define a single test case and its expectations.
  it('throws INVALID_RESPONSE when body lacks success field', async () => {
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal(
      // Supply the literal value used by the enclosing expression.
      'fetch',
      // Call vi.fn to perform this step.
      vi.fn().mockResolvedValue(jsonResponse({ foo: 'bar' })),
    );

    // Wait until the asynchronous operation resolves.
    await expect(api('/cars')).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});

// Declare a test suite grouping related cases.
describe('apiFormData', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call setCsrfToken to perform this step.
    setCsrfToken('form-token');
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call vi.unstubAllGlobals to perform this step.
    vi.unstubAllGlobals();
  });

  // Define a single test case and its expectations.
  it('omits Content-Type and attaches X-CSRF-Token on mutating uploads', async () => {
    // Create the fetch mock constant.
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: {} }));
    // Call vi.stubGlobal to perform this step.
    vi.stubGlobal('fetch', fetchMock);

    // Create the form data constant.
    const formData = new FormData();
    // Call formData.append to perform this step.
    formData.append('name', 'test');
    // Wait until the asynchronous operation resolves.
    await apiFormData('/api/upload', formData);

    // Create the headers constant.
    const headers = new Headers(fetchMock.mock.calls[0][1]?.headers as HeadersInit);
    // Assert that the value matches the intended expectation.
    expect(headers.has('Content-Type')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(headers.get('X-CSRF-Token')).toBe('form-token');
  });
});
