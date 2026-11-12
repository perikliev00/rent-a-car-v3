/**
 * Shared HTTP client for the admin SPA.
 *
 * Responsibilities: versioned paths, cookie credentials, CSRF on mutating
 * methods (with one automatic retry on CSRF_INVALID), and normalizing API
 * error/empty/non-JSON responses into {@link ApiError}.
 */
import type { ApiErrorBody, ApiResponse, ApiSuccess } from '../types/api';
// Import named exports from '../sentry'.
import { setSentryRequestId } from '../sentry';

// Create the api base constant.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Canonical API version prefix for first-party clients. */
export const API_PREFIX = '/api/v1';

/**
 * Normalize API paths to `/api/v1/...`.
 * Accepts legacy `/api/...`, already-versioned `/api/v1/...`, or root-relative `/cars`.
 *
 * @param path - Absolute or legacy API path from call sites
 */
export function toVersionedApiPath(path: string): string {
  // Already versioned — leave unchanged (including exact `/api/v1`).
  if (path.startsWith('/api/v1/') || path === '/api/v1') {
    // Return the resulting value to the caller.
    return path;
  }
  // Legacy `/api/...` → strip `/api/` and re-prefix with `/api/v1/`.
  if (path.startsWith('/api/')) {
    // Return the resulting value to the caller.
    return `${API_PREFIX}/${path.slice('/api/'.length)}`;
  }
  // Root-relative path like `/cars`.
  if (path.startsWith('/')) {
    // Return the resulting value to the caller.
    return `${API_PREFIX}${path}`;
  }
  // Relative segment without leading slash.
  return `${API_PREFIX}/${path}`;
}

// Create the mutating methods constant.
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

// Continue the surrounding logic with this statement.
let cachedCsrfToken: string | null = null;
/** In-flight CSRF fetch so concurrent mutations share one round-trip. */
let csrfFetchPromise: Promise<string | null> | null = null;

/**
 * Clears or seeds the in-memory CSRF token (e.g. after logout).
 * @param token - Token string, or `null` to clear
 */
export function setCsrfToken(token: string | null) {
  // Update cachedCsrfToken with the right-hand side value.
  cachedCsrfToken = token;
}

/**
 * If a successful response payload includes `csrfToken`, cache it for later mutations.
 * @param data - Unwrapped API `data` field (or similar object)
 */
function captureCsrfTokenFromData(data: unknown) {
  // Evaluate the condition and enter the branch when it is true.
  if (typeof data === 'object' && data !== null && 'csrfToken' in data) {
    // Create the token constant.
    const token = (data as { csrfToken?: unknown }).csrfToken;
    // Evaluate the condition and enter the branch when it is true.
    if (typeof token === 'string' && token.length > 0) {
      // Update cachedCsrfToken with the right-hand side value.
      cachedCsrfToken = token;
    }
  }
}

/**
 * Fetch (or join an in-flight fetch of) the CSRF token from `/api/auth/csrf`.
 * Always clears `csrfFetchPromise` in `finally` so later calls can refetch.
 */
async function fetchCsrfToken(): Promise<string | null> {
  // Deduplicate concurrent callers onto one network request.
  if (csrfFetchPromise) {
    // Return the resulting value to the caller.
    return csrfFetchPromise;
  }

  // Update csrfFetchPromise with the right-hand side value.
  csrfFetchPromise = (async () => {
    // Start a try block for operations that may fail.
    try {
      // Create the res constant.
      const res = await fetch(`${API_BASE}${toVersionedApiPath('/api/auth/csrf')}`, {
        // Provide the method field value.
        method: 'GET',
        // Provide the credentials field value.
        credentials: 'include',
      });
      // Create the body constant.
      const body = await parseResponseBody(res);
      // Successful envelope may embed a fresh token in `data`.
      if (body.success) {
        // Call captureCsrfTokenFromData to perform this step.
        captureCsrfTokenFromData((body as ApiSuccess<unknown>).data);
      }
      // Return the resulting value to the caller.
      return cachedCsrfToken;
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Allow a future refetch after this attempt settles.
      csrfFetchPromise = null;
    }
  // Continue the surrounding logic with this statement.
  })();

  // Return the resulting value to the caller.
  return csrfFetchPromise;
}

/**
 * Ensure a CSRF token is available before mutating requests.
 * Non-mutating methods return the cache as-is (may be null).
 *
 * @param method - HTTP method of the pending request
 */
async function ensureCsrfToken(method: string): Promise<string | null> {
  // Safe methods do not require a token; still return any cached value.
  if (!MUTATING_METHODS.has(method.toUpperCase())) {
    // Return the resulting value to the caller.
    return cachedCsrfToken;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (cachedCsrfToken) {
    // Return the resulting value to the caller.
    return cachedCsrfToken;
  }

  // Return the resulting value to the caller.
  return fetchCsrfToken();
}

/**
 * Whether the HTTP method can change server state (needs CSRF).
 * @param method - Method string; defaults to GET when omitted
 */
function isMutatingMethod(method: string | undefined): boolean {
  // Return the resulting value to the caller.
  return MUTATING_METHODS.has((method ?? 'GET').toUpperCase());
}

/** Typed API failure; `conflicts` is used by calendar force-override flows. */
export class ApiError extends Error {
  // Contribute this line to the enclosing declaration or statement.
  conflicts?: unknown[];

  /**
   * @param code - Machine-readable error code from the API (or client-side sentinel)
   * @param message - Human-readable message for toasts/UI
   * @param status - HTTP status (0 for network failures)
   * @param conflicts - Optional calendar conflict list attached by the server
   */
  constructor(
    // Contribute this line to the enclosing declaration or statement.
    public code: string,
    // Provide the message field value.
    message: string,
    // Contribute this line to the enclosing declaration or statement.
    public status: number,
    // Contribute this line to the enclosing declaration or statement.
    conflicts?: unknown[],
  // Continue the surrounding logic with this statement.
  ) {
    // Call super to perform this step.
    super(message);
    // Update this.name with the right-hand side value.
    this.name = 'ApiError';
    // Update this.conflicts with the right-hand side value.
    this.conflicts = conflicts;
  }
}

/**
 * True when Content-Type is JSON (including `+json` suffixes).
 * @param contentType - Raw Content-Type header value
 */
function isJsonContentType(contentType: string): boolean {
  // Drop parameters after `;` and normalize case.
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  // Return the resulting value to the caller.
  return normalized === 'application/json' || normalized.endsWith('+json');
}

/**
 * Heuristic: body looks like JSON even if Content-Type was wrong/missing.
 * @param text - Raw response text
 */
function looksLikeJson(text: string): boolean {
  // Create the trimmed constant.
  const trimmed = text.trim();
  // Return the resulting value to the caller.
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/**
 * User-facing message when the response body is empty.
 * @param status - HTTP status from the empty response
 */
function getEmptyBodyMessage(status: number): string {
  // Evaluate the condition and enter the branch when it is true.
  if (status === 0) {
    // Return the resulting value to the caller.
    return 'Unable to reach the server. Check your connection.';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (status >= 500) {
    // Return the resulting value to the caller.
    return `Server error (HTTP ${status}) with an empty response.`;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (status === 401) {
    // Return the resulting value to the caller.
    return 'Unauthorized — please log in again.';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (status === 403) {
    // Return the resulting value to the caller.
    return 'Access denied.';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (status === 404) {
    // Return the resulting value to the caller.
    return 'The requested resource was not found.';
  }
  // Return the resulting value to the caller.
  return `Empty response from server (HTTP ${status}).`;
}

/**
 * User-facing message when the response is not JSON.
 * @param status - HTTP status
 * @param contentType - Declared Content-Type (may be empty)
 */
function getNonJsonMessage(status: number, contentType: string): string {
  // Create the type hint constant.
  const typeHint = contentType.trim() || 'unknown content type';

  // HTML usually means a proxy/gateway error page, not our API envelope.
  if (contentType.toLowerCase().includes('text/html')) {
    // Return the resulting value to the caller.
    return `Server returned an HTML page instead of JSON (HTTP ${status}). This often indicates a proxy or server error.`;
  }

  // Return the resulting value to the caller.
  return `Expected a JSON response but received ${typeHint} (HTTP ${status}).`;
}

/**
 * Fallback message when the API envelope lacks a useful error message.
 * @param status - HTTP status
 */
function getHttpErrorMessage(status: number): string {
  // Evaluate the condition and enter the branch when it is true.
  if (status >= 500) {
    // Return the resulting value to the caller.
    return `Server error (HTTP ${status}).`;
  }
  // Evaluate the condition and enter the branch when it is true.
  if (status === 401) {
    // Return the resulting value to the caller.
    return 'Unauthorized — please log in again.';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (status === 403) {
    // Return the resulting value to the caller.
    return 'Access denied.';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (status === 404) {
    // Return the resulting value to the caller.
    return 'The requested resource was not found.';
  }
  // Return the resulting value to the caller.
  return `Request failed (HTTP ${status}).`;
}

/**
 * Narrow unknown JSON to the shared `{ success: ... }` API envelope shape.
 * @param value - Parsed JSON body
 */
function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  // Return the resulting value to the caller.
  return typeof value === 'object' && value !== null && 'success' in value;
}

/**
 * Read and validate the response body into an {@link ApiResponse}.
 * Throws {@link ApiError} for empty, non-JSON, malformed, or unexpected shapes.
 *
 * @param res - Fetch Response
 */
async function parseResponseBody(res: Response): Promise<ApiResponse<unknown>> {
  // Create the content type constant.
  const contentType = res.headers.get('content-type') ?? '';
  // Create the text constant.
  const text = await res.text();
  // Create the trimmed constant.
  const trimmed = text.trim();

  // Empty body — map to a status-aware message.
  if (!trimmed) {
    // Throw an error to stop the current control flow.
    throw new ApiError('EMPTY_RESPONSE', getEmptyBodyMessage(res.status), res.status);
  }

  // Prefer Content-Type, but also accept JSON-looking bodies with wrong headers.
  const shouldParseAsJson = isJsonContentType(contentType) || looksLikeJson(trimmed);

  // Evaluate the condition and enter the branch when it is true.
  if (!shouldParseAsJson) {
    // Throw an error to stop the current control flow.
    throw new ApiError(
      // Supply the literal value used by the enclosing expression.
      'INVALID_CONTENT_TYPE',
      // Call getNonJsonMessage to perform this step.
      getNonJsonMessage(res.status, contentType),
      // Contribute this line to the enclosing declaration or statement.
      res.status,
    );
  }

  // Contribute this line to the enclosing declaration or statement.
  let body: unknown;
  // Start a try block for operations that may fail.
  try {
    // Update body with the right-hand side value.
    body = JSON.parse(trimmed);
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Throw an error to stop the current control flow.
    throw new ApiError(
      // Supply the literal value used by the enclosing expression.
      'INVALID_JSON',
      // Continue the surrounding logic with this statement.
      `Server returned malformed JSON (HTTP ${res.status}).`,
      // Contribute this line to the enclosing declaration or statement.
      res.status,
    );
  }

  // Require the shared success/error envelope.
  if (!isApiResponse(body)) {
    // Throw an error to stop the current control flow.
    throw new ApiError(
      // Supply the literal value used by the enclosing expression.
      'INVALID_RESPONSE',
      // Continue the surrounding logic with this statement.
      `Unexpected response format (HTTP ${res.status}).`,
      // Contribute this line to the enclosing declaration or statement.
      res.status,
    );
  }

  // Return the resulting value to the caller.
  return body;
}

/**
 * Core authenticated fetch: CSRF header, Sentry request id, error unwrap, CSRF retry once.
 *
 * @param url - Fully qualified request URL
 * @param options - Fetch options (method, headers, body, …)
 * @param retriedCsrf - Internal flag; true after one CSRF_INVALID retry
 */
async function request<T>(url: string, options: RequestInit, retriedCsrf = false): Promise<T> {
  // Create the method constant.
  const method = (options.method ?? 'GET').toUpperCase();
  // Create the csrf token constant.
  const csrfToken = await ensureCsrfToken(method);

  // Clone headers so we can attach CSRF without mutating the caller's object.
  const headers = new Headers(options.headers);
  // Evaluate the condition and enter the branch when it is true.
  if (csrfToken && isMutatingMethod(method)) {
    // Call headers.set to perform this step.
    headers.set('X-CSRF-Token', csrfToken);
  }

  // Contribute this line to the enclosing declaration or statement.
  let res: Response;

  // Start a try block for operations that may fail.
  try {
    // Store the awaited result in res.
    res = await fetch(url, { ...options, headers });
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // DNS / offline / CORS network failure (no HTTP response).
    throw new ApiError(
      // Supply the literal value used by the enclosing expression.
      'NETWORK_ERROR',
      // Supply the literal value used by the enclosing expression.
      'Unable to reach the server. Check your connection.',
      // Supply the literal value used by the enclosing expression.
      0,
    );
  }

  // Correlate frontend errors with backend logs when the header is present.
  setSentryRequestId(res.headers.get('X-Request-Id') ?? res.headers.get('X-Correlation-Id'));

  // Create the body constant.
  const body = await parseResponseBody(res);

  // Evaluate the condition and enter the branch when it is true.
  if (!body.success) {
    // Create the error body constant.
    const errorBody = body as ApiErrorBody;
    // One automatic retry: clear cache, refetch CSRF, replay the same request.
    if (
      // Contribute this line to the enclosing declaration or statement.
      !retriedCsrf &&
      // Continue the surrounding logic with this statement.
      errorBody.error?.code === 'CSRF_INVALID' &&
      // Call isMutatingMethod to perform this step.
      isMutatingMethod(method)
    // Continue the surrounding logic with this statement.
    ) {
      // Update cachedCsrfToken with the right-hand side value.
      cachedCsrfToken = null;
      // Wait until the asynchronous operation resolves.
      await fetchCsrfToken();
      // Return the resulting value to the caller.
      return request<T>(url, options, true);
    }
    // Throw an error to stop the current control flow.
    throw new ApiError(
      // Contribute this line to the enclosing declaration or statement.
      errorBody.error?.code ?? 'UNKNOWN',
      // Continue the surrounding logic with this statement.
      errorBody.error?.message ?? getHttpErrorMessage(res.status),
      // Contribute this line to the enclosing declaration or statement.
      res.status,
      // Continue the surrounding logic with this statement.
      (errorBody.error as { conflicts?: unknown[] } | undefined)?.conflicts,
    );
  }

  // Create the data constant.
  const data = (body as ApiSuccess<T>).data;
  // Some success payloads rotate/seed CSRF for subsequent mutations.
  captureCsrfTokenFromData(data);
  // Return the resulting value to the caller.
  return data;
}

/**
 * JSON API helper. Skips default Content-Type when the body is FormData so
 * the browser can set the multipart boundary.
 *
 * @param path - API path (versioned by {@link toVersionedApiPath})
 * @param options - Optional fetch overrides
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  // Create the is form data constant.
  const isFormData = options.body instanceof FormData;

  // Return the resulting value to the caller.
  return request<T>(`${API_BASE}${toVersionedApiPath(path)}`, {
    // Spread options into the surrounding structure.
    ...options,
    // Provide the credentials field value.
    credentials: 'include',
    // FormData: do not force application/json (would break multipart boundary).
    headers: isFormData
      // Contribute this line to the enclosing declaration or statement.
      ? options.headers
      // Contribute this line to the enclosing declaration or statement.
      : { 'Content-Type': 'application/json', ...options.headers },
  });
}

/**
 * Multipart upload helper (documents, damage photos, checklists).
 *
 * @param path - API path
 * @param formData - Multipart body
 * @param method - HTTP method (default POST)
 */
export async function apiFormData<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  // Return the resulting value to the caller.
  return request<T>(`${API_BASE}${toVersionedApiPath(path)}`, {
    // Contribute this line to the enclosing declaration or statement.
    method,
    // Provide the credentials field value.
    credentials: 'include',
    // Provide the body field value.
    body: formData,
  });
}

/**
 * Cookie-authenticated file download via a temporary object URL.
 * Side effects: creates a transient `<a download>` click and revokes the object URL.
 *
 * @param path - Authenticated download path
 * @param fallbackName - Filename used for the download attribute
 */
export async function downloadAuthenticated(path: string, fallbackName: string): Promise<void> {
  // Create the res constant.
  const res = await fetch(`${API_BASE}${toVersionedApiPath(path)}`, { credentials: 'include' });
  // Evaluate the condition and enter the branch when it is true.
  if (!res.ok) {
    // Throw an error to stop the current control flow.
    throw new Error('Download failed');
  }
  // Create the blob constant.
  const blob = await res.blob();
  // Temporary object URL so the browser can download the blob with cookies already used above.
  const url = URL.createObjectURL(blob);
  // Create the a constant.
  const a = document.createElement('a');
  // Update a.href with the right-hand side value.
  a.href = url;
  // Update a.download with the right-hand side value.
  a.download = fallbackName;
  // Call a.click to perform this step.
  a.click();
  // Free the blob URL after the click is queued.
  URL.revokeObjectURL(url);
}

// Re-export the listed bindings.
export { API_BASE };
