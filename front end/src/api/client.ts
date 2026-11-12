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
// Import named exports from '../sentry'.
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
    // Return the resulting value to the caller.
    return path;
  }
  // Legacy `/api/...` → strip the old prefix and re-attach `/api/v1`.
  if (path.startsWith('/api/')) {
    // Return the resulting value to the caller.
    return `${API_PREFIX}/${path.slice('/api/'.length)}`;
  }
  // Root-relative `/cars` → `/api/v1/cars`.
  if (path.startsWith('/')) {
    // Return the resulting value to the caller.
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
  // Update cachedCsrfToken with the right-hand side value.
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
 * GET `/api/auth/csrf` and cache the returned token for subsequent mutations.
 *
 * @returns The cached token after the fetch completes (may still be null on failure).
 * @remarks Side effect: sets/clears `csrfFetchPromise` and may update `cachedCsrfToken`.
 */
async function fetchCsrfToken(): Promise<string | null> {
  // Coalesce concurrent callers onto one in-flight request.
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
      // Successful CSRF responses embed the token inside `data`.
      if (body.success) {
        // Call captureCsrfTokenFromData to perform this step.
        captureCsrfTokenFromData((body as ApiSuccess<unknown>).data);
      }
      // Return the resulting value to the caller.
      return cachedCsrfToken;
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Allow a future refresh after this attempt settles (success or failure).
      csrfFetchPromise = null;
    }
  // Continue the surrounding logic with this statement.
  })();

  // Return the resulting value to the caller.
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
    // Return the resulting value to the caller.
    return cachedCsrfToken;
  }

  // Reuse a warm token when present.
  if (cachedCsrfToken) {
    // Return the resulting value to the caller.
    return cachedCsrfToken;
  }

  // Return the resulting value to the caller.
  return fetchCsrfToken();
}

/**
 * Whether the HTTP method mutates server state and therefore needs CSRF.
 *
 * @param method - Optional method; defaults to GET when omitted.
 * @returns `true` for POST/PUT/PATCH/DELETE.
 */
function isMutatingMethod(method: string | undefined): boolean {
  // Return the resulting value to the caller.
  return MUTATING_METHODS.has((method ?? 'GET').toUpperCase());
}

/**
 * Typed API failure thrown by {@link api} / {@link request}.
 * `conflicts` carries optional booking-hold conflict payloads from the backend.
 */
export class ApiError extends Error {
  // Contribute this line to the enclosing declaration or statement.
  conflicts?: unknown[];

  /**
   * @param code - Stable machine-readable error code from the API or client.
   * @param message - Human-readable message for UI toasts/forms.
   * @param status - HTTP status (0 for network failures).
   * @param conflicts - Optional conflict payloads (e.g. overlapping holds).
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
 * Detect JSON (or JSON-derived) Content-Type headers.
 *
 * @param contentType - Raw `Content-Type` header value.
 * @returns `true` for `application/json` and `*+json` subtypes.
 */
function isJsonContentType(contentType: string): boolean {
  // Strip parameters such as `charset=utf-8` before comparing.
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  // Return the resulting value to the caller.
  return normalized === 'application/json' || normalized.endsWith('+json');
}

/**
 * Heuristic: body text looks like a JSON value even if Content-Type is wrong.
 *
 * @param text - Raw response body text.
 * @returns `true` when trimmed text starts with `{` or `[`.
 */
function looksLikeJson(text: string): boolean {
  // Create the trimmed constant.
  const trimmed = text.trim();
  // Return the resulting value to the caller.
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

/**
 * User-facing message for empty HTTP bodies, keyed by status class.
 *
 * @param status - HTTP status (0 = network unreachable).
 * @returns Localized-enough English message for toasts.
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
 *
 * @param status - HTTP status.
 * @param contentType - Reported content type (may be empty).
 * @returns Message that distinguishes HTML/proxy pages from other non-JSON types.
 */
function getNonJsonMessage(status: number, contentType: string): string {
  // Create the type hint constant.
  const typeHint = contentType.trim() || 'unknown content type';

  // HTML usually means a reverse-proxy or SPA fallback page, not the API.
  if (contentType.toLowerCase().includes('text/html')) {
    // Return the resulting value to the caller.
    return `Server returned an HTML page instead of JSON (HTTP ${status}). This often indicates a proxy or server error.`;
  }

  // Return the resulting value to the caller.
  return `Expected a JSON response but received ${typeHint} (HTTP ${status}).`;
}

/**
 * Fallback message when the envelope has no `error.message`.
 *
 * @param status - HTTP status.
 * @returns Generic status-based English message.
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
 * Type guard for the standard `{ success: boolean, ... }` API envelope.
 *
 * @param value - Parsed JSON body.
 * @returns Whether `value` looks like an {@link ApiResponse}.
 */
function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  // Return the resulting value to the caller.
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
  // Create the content type constant.
  const contentType = res.headers.get('content-type') ?? '';
  // Create the text constant.
  const text = await res.text();
  // Create the trimmed constant.
  const trimmed = text.trim();

  // Empty bodies cannot be unwrapped into the envelope contract.
  if (!trimmed) {
    // Throw an error to stop the current control flow.
    throw new ApiError('EMPTY_RESPONSE', getEmptyBodyMessage(res.status), res.status);
  }

  // Trust Content-Type, but also accept JSON-looking bodies with wrong headers.
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

  // Require the shared envelope so callers can rely on `success` / `data` / `error`.
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
  // Create the method constant.
  const method = (options.method ?? 'GET').toUpperCase();
  // Create the csrf token constant.
  const csrfToken = await ensureCsrfToken(method);

  // Create the headers constant.
  const headers = new Headers(options.headers);
  // Attach CSRF only on mutating verbs when we have a token.
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
    // fetch() rejects on DNS/offline/CORS network failures (not HTTP error statuses).
    throw new ApiError(
      // Supply the literal value used by the enclosing expression.
      'NETWORK_ERROR',
      // Supply the literal value used by the enclosing expression.
      'Unable to reach the server. Check your connection.',
      // Supply the literal value used by the enclosing expression.
      0,
    );
  }

  // Prefer X-Request-Id; fall back to X-Correlation-Id for older proxies.
  setSentryRequestId(res.headers.get('X-Request-Id') ?? res.headers.get('X-Correlation-Id'));

  // Create the body constant.
  const body = await parseResponseBody(res);

  // Evaluate the condition and enter the branch when it is true.
  if (!body.success) {
    // Create the error body constant.
    const errorBody = body as ApiErrorBody;
    // One automatic CSRF refresh + retry for mutating calls.
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
  // Some success payloads rotate the CSRF token inline.
  captureCsrfTokenFromData(data);
  // Return the resulting value to the caller.
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
  // Create the is form data constant.
  const isFormData = options.body instanceof FormData;

  // Return the resulting value to the caller.
  return request<T>(`${API_BASE}${toVersionedApiPath(path)}`, {
    // Spread options into the surrounding structure.
    ...options,
    // Provide the credentials field value.
    credentials: 'include',
    // Provide the headers field value.
    headers: isFormData
      // Contribute this line to the enclosing declaration or statement.
      ? options.headers
      // Contribute this line to the enclosing declaration or statement.
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

// Re-export the listed bindings.
export { API_BASE };
