import type { ApiErrorBody, ApiResponse, ApiSuccess } from '../types/api';
import { setSentryRequestId } from '../sentry';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

/** Canonical API version prefix for first-party clients. */
export const API_PREFIX = '/api/v1';

/**
 * Normalize API paths to `/api/v1/...`.
 * Accepts legacy `/api/...`, already-versioned `/api/v1/...`, or root-relative `/cars`.
 */
export function toVersionedApiPath(path: string): string {
  if (path.startsWith('/api/v1/') || path === '/api/v1') {
    return path;
  }
  if (path.startsWith('/api/')) {
    return `${API_PREFIX}/${path.slice('/api/'.length)}`;
  }
  if (path.startsWith('/')) {
    return `${API_PREFIX}${path}`;
  }
  return `${API_PREFIX}/${path}`;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

let cachedCsrfToken: string | null = null;
let csrfFetchPromise: Promise<string | null> | null = null;

export function setCsrfToken(token: string | null) {
  cachedCsrfToken = token;
}

function captureCsrfTokenFromData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'csrfToken' in data) {
    const token = (data as { csrfToken?: unknown }).csrfToken;
    if (typeof token === 'string' && token.length > 0) {
      cachedCsrfToken = token;
    }
  }
}

async function fetchCsrfToken(): Promise<string | null> {
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
      if (body.success) {
        captureCsrfTokenFromData((body as ApiSuccess<unknown>).data);
      }
      return cachedCsrfToken;
    } finally {
      csrfFetchPromise = null;
    }
  })();

  return csrfFetchPromise;
}

async function ensureCsrfToken(method: string): Promise<string | null> {
  if (!MUTATING_METHODS.has(method.toUpperCase())) {
    return cachedCsrfToken;
  }

  if (cachedCsrfToken) {
    return cachedCsrfToken;
  }

  return fetchCsrfToken();
}

function isMutatingMethod(method: string | undefined): boolean {
  return MUTATING_METHODS.has((method ?? 'GET').toUpperCase());
}

export class ApiError extends Error {
  conflicts?: unknown[];

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

function isJsonContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase().split(';')[0]?.trim() ?? '';
  return normalized === 'application/json' || normalized.endsWith('+json');
}

function looksLikeJson(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.startsWith('{') || trimmed.startsWith('[');
}

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

function getNonJsonMessage(status: number, contentType: string): string {
  const typeHint = contentType.trim() || 'unknown content type';

  if (contentType.toLowerCase().includes('text/html')) {
    return `Server returned an HTML page instead of JSON (HTTP ${status}). This often indicates a proxy or server error.`;
  }

  return `Expected a JSON response but received ${typeHint} (HTTP ${status}).`;
}

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

function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return typeof value === 'object' && value !== null && 'success' in value;
}

async function parseResponseBody(res: Response): Promise<ApiResponse<unknown>> {
  const contentType = res.headers.get('content-type') ?? '';
  const text = await res.text();
  const trimmed = text.trim();

  if (!trimmed) {
    throw new ApiError('EMPTY_RESPONSE', getEmptyBodyMessage(res.status), res.status);
  }

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

  if (!isApiResponse(body)) {
    throw new ApiError(
      'INVALID_RESPONSE',
      `Unexpected response format (HTTP ${res.status}).`,
      res.status,
    );
  }

  return body;
}

async function request<T>(url: string, options: RequestInit, retriedCsrf = false): Promise<T> {
  const method = (options.method ?? 'GET').toUpperCase();
  const csrfToken = await ensureCsrfToken(method);

  const headers = new Headers(options.headers);
  if (csrfToken && isMutatingMethod(method)) {
    headers.set('X-CSRF-Token', csrfToken);
  }

  let res: Response;

  try {
    res = await fetch(url, { ...options, headers });
  } catch {
    throw new ApiError(
      'NETWORK_ERROR',
      'Unable to reach the server. Check your connection.',
      0,
    );
  }

  setSentryRequestId(res.headers.get('X-Request-Id') ?? res.headers.get('X-Correlation-Id'));

  const body = await parseResponseBody(res);

  if (!body.success) {
    const errorBody = body as ApiErrorBody;
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
  captureCsrfTokenFromData(data);
  return data;
}

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

export async function apiFormData<T>(path: string, formData: FormData, method = 'POST'): Promise<T> {
  return request<T>(`${API_BASE}${toVersionedApiPath(path)}`, {
    method,
    credentials: 'include',
    body: formData,
  });
}

export async function downloadAuthenticated(path: string, fallbackName: string): Promise<void> {
  const res = await fetch(`${API_BASE}${toVersionedApiPath(path)}`, { credentials: 'include' });
  if (!res.ok) {
    throw new Error('Download failed');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fallbackName;
  a.click();
  URL.revokeObjectURL(url);
}

export { API_BASE };
