/**
 * Shared HTTP client for the admin SPA.
 *
 * Responsibilities: versioned paths, cookie credentials, CSRF on mutating
 * methods (with one automatic retry on CSRF_INVALID), and normalizing API
 * error/empty/non-JSON responses into {@link ApiError}.
 */
import type { ApiErrorBody, ApiResponse, ApiSuccess } from '../types/api';
import { setSentryRequestId } from '../sentry';

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
    return path;
  }
  // Legacy `/api/...` → strip `/api/` and re-prefix with `/api/v1/`.
  if (path.startsWith('/api/')) {
    return `${API_PREFIX}/${path.slice('/api/'.length)}`;
  }
  // Root-relative path like `/cars`.
  if (path.startsWith('/')) {
    return `${API_PREFIX}${path}`;
  }
  // Relative segment without leading slash.
  return `${API_PREFIX}/${path}`;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let cachedCsrfToken: string | null = null;
/** In-flight CSRF fetch so concurrent mutations share one round-trip. */
let csrfFetchPromise: Promise<string | null> | null = null;

/**
 * Clears or seeds the in-memory CSRF token (e.g. after logout).
 * @param token - Token string, or `null` to clear
 */
export function setCsrfToken(token: string | null) {
  cachedCsrfToken = token;
}

/**
 * If a successful response payload includes `csrfToken`, cache it for later mutations.
 * @param data - Unwrapped API `data` field (or similar object)
 */
function captureCsrfTokenFromData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'csrfToken' in data) {
    const token = (data as { csrfToken?: unknown }).csrfToken;
    if (typeof token === 'string' && token.length > 0) {
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
    return csrfFetchPromise;
  }

  csrfFetchPromise = (async () => {
    try {
      const res = await fetch(`${API_BASE}${toVersionedApiPath('/api/auth/csrf')}`, {
        method: 'GET',
        credentials: 'include',
      });
      const body = await parseResponseBody(res);
      // Successful envelope may embed a fresh token in `data`.
      if (body.success) {
        captureCsrfTokenFromData((body as ApiSuccess<unknown>).data);
      }
      return cachedCsrfToken;
    } finally {
      // Allow a future refetch after this attempt settles.
      csrfFetchPromise = null;
    }
  })();

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
    return cachedCsrfToken;
  }

  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  return fetchCsrfToken();
}

/**
 * Whether the HTTP method can change server state (needs CSRF).
 * @param method - Method string; defaults to GET when omitted
 */
function isMutatingMethod(method: string | undefined): boolean {
  return MUTATING_METHODS.has((method ?? 'GET').toUpperCase());
}

/** Typed API failure; `conflicts` is used by calendar force-override flows. */
export class ApiError extends Error {
  conflicts?: unknown[];

  /**
   * @param code - Machine-readable error code from the API (or client-side sentinel)
   * @param message - Human-readable message for toasts/UI
   * @param status - HTTP status (0 for network failures)
   * @param conflicts - Optional calendar conflict list attached by the server
   */
  constructor(
    public code: string,
    message: string,
    public status: number,
    conflicts?: unknown[],
  ) {
    super(message);
    this.name = 'ApiError';
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
  return normalized === 'application/json' || normalized.endsWith('+json');
}

/**
 * Heuristic: body looks like JSON even if Content-Type was wrong/missing.
 * @param text - Raw response text
 */
function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/**
 * User-facing message when the response body is empty.
 * @param status - HTTP status from the empty response
 */
function getEmptyBodyMessage(status: number): string {
  if (status === 0) {
    return 'Unable to reach the server. Check your connection.';
  }
  if (status >= 500) {
    return `Server error (HTTP ${status}) with an empty response.`;
  }
  if (status === 401) {
    return 'Unauthorized — please log in again.';
  }
  if (status === 403) {
    return 'Access denied.';
  }
  if (status === 404) {
    return 'The requested resource was not found.';
  }
  return `Empty response from server (HTTP ${status}).`;
}

/**
 * User-facing message when the response is not JSON.
 * @param status - HTTP status
 * @param contentType - Declared Content-Type (may be empty)
 */
function getNonJsonMessage(status: number, contentType: string): string {
  const typeHint = contentType.trim() || 'unknown content type';

  // HTML usually means a proxy/gateway error page, not our API envelope.
  if (contentType.toLowerCase().includes('text/html')) {
    return `Server returned an HTML page instead of JSON (HTTP ${status}). This often indicates a proxy or server error.`;
  }

  return `Expected a JSON response but received ${typeHint} (HTTP ${status}).`;
}

/**
 * Fallback message when the API envelope lacks a useful error message.
 * @param status - HTTP status
 */
function getHttpErrorMessage(status: number): string {
  if (status >= 500) {
    return `Server error (HTTP ${status}).`;
  }
  if (status === 401) {
    return 'Unauthorized — please log in again.';
  }
  if (status === 403) {
    return 'Access denied.';
  }
  if (status === 404) {
    return 'The requested resource was not found.';
  }
  return `Request failed (HTTP ${status}).`;
}

/**
 * Narrow unknown JSON to the shared `{ success: ... }` API envelope shape.
 * @param value - Parsed JSON body
 */
function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

/**
 * Read and validate the response body into an {@link ApiResponse}.
 * Throws {@link ApiError} for empty, non-JSON, malformed, or unexpected shapes.
 *
 * @param res - Fetch Response
 */
async function parseResponseBody(res: Response): Promise<ApiResponse<unknown>> {
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  const trimmed = text.trim();

  // Empty body — map to a status-aware message.
  if (!trimmed) {
    throw new ApiError('EMPTY_RESPONSE', getEmptyBodyMessage(res.status), res.status);
  }

  // Prefer Content-Type, but also accept JSON-looking bodies with wrong headers.
  const shouldParseAsJson = isJsonContentType(contentType) || looksLikeJson(trimmed);

  if (!shouldParseAsJson) {
    throw new ApiError(
      'INVALID_CONTENT_TYPE',
      getNonJsonMessage(res.status, contentType),
      res.status,
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(trimmed);
  } catch {
    throw new ApiError(
      'INVALID_JSON',
      `Server returned malformed JSON (HTTP ${res.status}).`,
      res.status,
    );
  }

  // Require the shared success/error envelope.
  if (!isApiResponse(body)) {
    throw new ApiError(
      'INVALID_RESPONSE',
      `Unexpected response format (HTTP ${res.status}).`,
      res.status,
    );
  }

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
  const method = (options.method ?? 'GET').toUpperCase();
  const csrfToken = await ensureCsrfToken(method);

  // Clone headers so we can attach CSRF without mutating the caller's object.
  const headers = new Headers(options.headers);
  if (csrfToken && isMutatingMethod(method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  let res: Response;

  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    // DNS / offline / CORS network failure (no HTTP response).
    throw new ApiError(
      'NETWORK_ERROR',
      'Unable to reach the server. Check your connection.',
      0,
    );
  }

  // Correlate frontend errors with backend logs when the header is present.
  setSentryRequestId(res.headers.get('X-Request-Id') ?? res.headers.get('X-Correlation-Id'));

  const body = await parseResponseBody(res);

  if (!body.success) {
    const errorBody = body as ApiErrorBody;
    // One automatic retry: clear cache, refetch CSRF, replay the same request.
    if (
      !retriedCsrf &&
      errorBody.error?.code === 'CSRF_INVALID' &&
      isMutatingMethod(method)
    ) {
      cachedCsrfToken = null;
      await fetchCsrfToken();
      return request<T>(url, options, true);
    }
    throw new ApiError(
      errorBody.error?.code ?? 'UNKNOWN',
      errorBody.error?.message ?? getHttpErrorMessage(res.status),
      res.status,
      (errorBody.error as { conflicts?: unknown[] } | undefined)?.conflicts,
    );
  }

  const data = (body as ApiSuccess<T>).data;
  // Some success payloads rotate/seed CSRF for subsequent mutations.
  captureCsrfTokenFromData(data);
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
  const isFormData = options.body instanceof FormData;

  return request<T>(`${API_BASE}${toVersionedApiPath(path)}`, {
    ...options,
    credentials: 'include',
    // FormData: do not force application/json (would break multipart boundary).
    headers: isFormData
      ? options.headers
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
  return request<T>(`${API_BASE}${toVersionedApiPath(path)}`, {
    method,
    credentials: 'include',
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
  const res = await fetch(`${API_BASE}${toVersionedApiPath(path)}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Download failed');
  }
  const blob = await res.blob();
  // Temporary object URL so the browser can download the blob with cookies already used above.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  a.click();
  // Free the blob URL after the click is queued.
  URL.revokeObjectURL(url);
}

export { API_BASE };
