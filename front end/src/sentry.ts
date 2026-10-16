/**
 * Optional Sentry bootstrap for the SPA.
 * No-ops when `VITE_SENTRY_DSN` is unset so local/dev builds stay quiet.
 */
import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry once at app startup when a DSN is configured.
 *
 * @remarks Side effect: registers the global Sentry client when `VITE_SENTRY_DSN` is set; no-ops otherwise.
 */
export function initSentry() {
  // Skip entirely in environments without a DSN (local/dev by default).
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    // Default to a low sample rate; override via env for staging/prod tuning.
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    sendDefaultPii: false,
  });
}

/**
 * Attach the backend request/correlation id to the current Sentry scope
 * so support can match client errors to server logs.
 *
 * @param requestId - Value from `X-Request-Id` / `X-Correlation-Id`, or null when absent.
 * @remarks Side effect: sets Sentry tags when both DSN and id are present; no-ops otherwise.
 */
export function setSentryRequestId(requestId: string | null) {
  if (!dsn || !requestId) {
    return;
  }
  Sentry.setTag('requestId', requestId);
  // Same id is tagged both ways so either search field finds the event.
  Sentry.setTag('correlationId', requestId);
}

export { Sentry };
