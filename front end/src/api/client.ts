/**
 * Shared HTTP client for the rent-a-car API.
 *
 * All first-party calls go through {@link api} / {@link apiFormData} so that:
 * - paths are normalized to `/api/v1/...`
 * - cookie sessions are sent (`credentials: 'include'`)
 * - CSRF tokens are attached to mutating methods and refreshed on CSRF_INVALID
 * - envelope responses (`{ success, data | error }`) are unwrapped or thrown as {@link ApiError}
 * - request/correlation IDs are forwarded to Sentry for support tracing
 */
import type { ApiErrorBody, ApiResponse, ApiSuccess } from '../types/api';
import { setSentryRequestId } from '../sentry';

/** Backend origin; defaults to local API when `VITE_API_BASE_URL` is unset. */
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Canonical API version prefix for first-party clients. */
export const API_PREFIX = '/api/v1';

/**
 * Normalize API paths to `/api/v1/...`.
 * Accepts legacy `/api/...`, already-versioned `/api/v1/...`, or root-relative `/cars`.
 *
 * @param path - Absolute or root-relative API path from callers.
 * @returns Path guaranteed to start with `/api/v1`.
 */
export function toVersionedApiPath(path: string): string {
  // Already on the canonical prefix — leave unchanged.
  if (path.startsWith('/api/v1/') || path === '/api/v1') {
    return path;
  }
  // Legacy `/api/...` → strip the old prefix and re-attach `/api/v1`.
  if (path.startsWith('/api/')) {
    return `${API_PREFIX}/${path.slice('/api/'.length)}`;
  }
  // Root-relative `/cars` → `/api/v1/cars`.
  if (path.startsWith('/')) {
    return `${API_PREFIX}${path}`;
  }
  // Bare `cars` → `/api/v1/cars`.
  return `${API_PREFIX}/${path}`;
}

/** HTTP methods that require a CSRF header under cookie-based auth. */
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** In-memory CSRF token; also cleared on logout so a stale token is never reused. */
let cachedCsrfToken: string | null = null;
/** Deduplicates concurrent CSRF fetches so only one round-trip runs at a time. */
let csrfFetchPromise: Promise<string | null> | null = null;

/**
 * Replace or clear the cached CSRF token (e.g. after logout).
 *
 * @param token - New token value, or `null` to clear.
 * @remarks Side effect: mutates module-level `cachedCsrfToken`.
 */
export function setCsrfToken(token: string | null) {
  cachedCsrfToken = token;
}

/**
 * Persist a CSRF token when the API embeds one in a successful payload.
 *
 * @param data - Unwrapped success `data` that may contain `csrfToken`.
 * @remarks Side effect: updates `cachedCsrfToken` when a non-empty string token is present.
 */
function captureCsrfTokenFromData(data: unknown) {
  // Only objects can carry an embedded token field.
  if (typeof data === 'object' && data !== null && 'csrfToken' in data) {
    const token = (data as { csrfToken?: unknown }).csrfToken;
    if (typeof token === 'string' && token.length > 0) {
      cachedCsrfToken = token;
    }
  }
}

/**
 * GET `/api/auth/csrf` and cache the returned token for subsequent mutations.
 *
 * @returns The cached token after the fetch completes (may still be null on failure).
 * @remarks Side effect: sets/clears `csrfFetchPromise` and may update `cachedCsrfToken`.
 */
async function fetchCsrfToken(): Promise<string | null> {
  // Coalesce concurrent callers onto one in-flight request.
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
      // Successful CSRF responses embed the token inside `data`.
      if (body.success) {
        captureCsrfTokenFromData((body as ApiSuccess<unknown>).data);
      }
      return cachedCsrfToken;
    } finally {
      // Allow a future refresh after this attempt settles (success or failure).
      csrfFetchPromise = null;
    }
  })();

  return csrfFetchPromise;
}

/**
 * For mutating methods, ensure a CSRF token is available (fetch if missing).
 * Safe/idempotent methods return the cache without forcing a fetch.
 *
 * @param method - HTTP method for the upcoming request.
 * @returns A CSRF token string, or null when none is required/available.
 */
async function ensureCsrfToken(method: string): Promise<string | null> {
  // GET/HEAD/OPTIONS never need a CSRF header.
  if (!MUTATING_METHODS.has(method.toUpperCase())) {
    return cachedCsrfToken;
  }

  // Reuse a warm token when present.
  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  return fetchCsrfToken();
}

/**
 * Whether the HTTP method mutates server state and therefore needs CSRF.
 *
 * @param method - Optional method; defaults to GET when omitted.
 * @returns `true` for POST/PUT/PATCH/DELETE.
 */
function isMutatingMethod(method: string | undefined): boolean {
  return MUTATING_METHODS.has((method ?? 'GET').toUpperCase());
}

/**
 * Typed API failure thrown by {@link api} / {@link request}.
 * `conflicts` carries optional booking-hold conflict payloads from the backend.
 */
export class ApiError extends Error {
  conflicts?: unknown[];

  /**
   * @param code - Stable machine-readable error code from the API or client.
   * @param message - Human-readable message for UI toasts/forms.
   * @param status - HTTP status (0 for network failures).
   * @param conflicts - Optional conflict payloads (e.g. overlapping holds).
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
 * Detect JSON (or JSON-derived) Content-Type headers.
 *
 * @param contentType - Raw `Content-Type` header value.
 * @returns `true` for `application/json` and `*+json` subtypes.
 */
function isJsonContentType(contentType: string): boolean {
  // Strip parameters such as `charset=utf-8` before comparing.
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  return normalized === 'application/json' || normalized.endsWith('+json');
}

/**
 * Heuristic: body text looks like a JSON value even if Content-Type is wrong.
 *
 * @param text - Raw response body text.
 * @returns `true` when trimmed text starts with `{` or `[`.
 */
function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/**
 * User-facing message for empty HTTP bodies, keyed by status class.
 *
 * @param status - HTTP status (0 = network unreachable).
 * @returns Localized-enough English message for toasts.
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
 *
 * @param status - HTTP status.
 * @param contentType - Reported content type (may be empty).
 * @returns Message that distinguishes HTML/proxy pages from other non-JSON types.
 */
function getNonJsonMessage(status: number, contentType: string): string {
  const typeHint = contentType.trim() || 'unknown content type';

  // HTML usually means a reverse-proxy or SPA fallback page, not the API.
  if (contentType.toLowerCase().includes('text/html')) {
    return `Server returned an HTML page instead of JSON (HTTP ${status}). This often indicates a proxy or server error.`;
  }

  return `Expected a JSON response but received ${typeHint} (HTTP ${status}).`;
}

/**
 * Fallback message when the envelope has no `error.message`.
 *
 * @param status - HTTP status.
 * @returns Generic status-based English message.
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
 * Type guard for the standard `{ success: boolean, ... }` API envelope.
 *
 * @param value - Parsed JSON body.
 * @returns Whether `value` looks like an {@link ApiResponse}.
 */
function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

/**
 * Read and validate the API envelope from an HTTP response.
 * Rejects empty bodies, HTML/proxy pages, malformed JSON, and non-envelope shapes
 * with stable {@link ApiError} codes so UI layers can show actionable messages.
 *
 * @param res - Fetch `Response` to read.
 * @returns Parsed success or error envelope.
 * @throws {ApiError} On empty, non-JSON, malformed JSON, or non-envelope bodies.
 */
async function parseResponseBody(res: Response): Promise<ApiResponse<unknown>> {
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  const trimmed = text.trim();

  // Empty bodies cannot be unwrapped into the envelope contract.
  if (!trimmed) {
    throw new ApiError('EMPTY_RESPONSE', getEmptyBodyMessage(res.status), res.status);
  }

  // Trust Content-Type, but also accept JSON-looking bodies with wrong headers.
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

  // Require the shared envelope so callers can rely on `success` / `data` / `error`.
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
 * Low-level fetch: attach CSRF, parse envelope, retry once on CSRF_INVALID.
 * `retriedCsrf` prevents infinite refresh loops when the new token is also rejected.
 *
 * @param url - Absolute request URL.
 * @param options - Fetch init (method, headers, body, etc.).
 * @param retriedCsrf - Internal flag set after one CSRF refresh retry.
 * @returns Unwrapped success `data` typed as `T`.
 * @throws {ApiError} On network failure, envelope errors, or exhausted CSRF retry.
 * @remarks Side effect: may refresh CSRF cache and set Sentry request-id tags.
 */
async function request<T>(url: string, options: RequestInit, retriedCsrf = false): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const csrfToken = await ensureCsrfToken(method);

  const headers = new Headers(options.headers);
  // Attach CSRF only on mutating verbs when we have a token.
  if (csrfToken && isMutatingMethod(method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  let res: Response;

  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    // fetch() rejects on DNS/offline/CORS network failures (not HTTP error statuses).
    throw new ApiError(
      'NETWORK_ERROR',
      'Unable to reach the server. Check your connection.',
      0,
    );
  }

  // Prefer X-Request-Id; fall back to X-Correlation-Id for older proxies.
  setSentryRequestId(res.headers.get('X-Request-Id') ?? res.headers.get('X-Correlation-Id'));

  const body = await parseResponseBody(res);

  if (!body.success) {
    const errorBody = body as ApiErrorBody;
    // One automatic CSRF refresh + retry for mutating calls.
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
  // Some success payloads rotate the CSRF token inline.
  captureCsrfTokenFromData(data);
  return data;
}

/**
 * JSON API helper: versioned path, cookie credentials, default `Content-Type`.
 * Skips setting JSON content-type for FormData so the browser can set the multipart boundary.
 *
 * @typeParam T - Expected unwrapped success `data` type.
 * @param path - API path (any form accepted by {@link toVersionedApiPath}).
 * @param options - Optional fetch init overrides.
 * @returns Unwrapped success data.
 * @remarks Side effect: performs a network request with cookies; may refresh CSRF.
 */
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;

  return request<T>(`${API_BASE}${toVersionedApiPath(path)}`, {
    ...options,
    credentials: 'include',
    headers: isFormData
      ? options.headers
      : { 'Content-Type': 'application/json', ...options.headers },
  });
}

/**
 * Multipart upload helper (documents, etc.).
 * Does not set Content-Type so the browser supplies `multipart/form-data` with boundary.
 *
 * @typeParam T - Expected unwrapped success `data` type.
 * @param path - API path for the upload endpoint.
 * @param formData - Multipart body including the file and fields.
 * @param method - HTTP method (defaults to POST).
 * @returns Unwrapped success data.
 * @remarks Side effect: performs a cookie-authenticated multipart request.
 */
export async function apiFormData<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  return request<T>(`${API_BASE}${toVersionedApiPath(path)}`, {
    method,
    credentials: 'include',
    body: formData,
  });
}

export { API_BASE };
