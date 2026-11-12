/**
 * Optional Sentry bootstrap for the SPA.
 * No-ops when `VITE_SENTRY_DSN` is unset so local/dev builds stay quiet.
 */
import * as Sentry from '@sentry/react';

// Create the dsn constant.
const dsn = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry once at app startup when a DSN is configured.
 *
 * @remarks Side effect: registers the global Sentry client when `VITE_SENTRY_DSN` is set; no-ops otherwise.
 */
export function initSentry() {
  // Skip entirely in environments without a DSN (local/dev by default).
  if (!dsn) {
    // Return control to the caller with the following value.
    return;
  }

  // Call Sentry.init to perform this step.
  Sentry.init({
    // Contribute this line to the enclosing declaration or statement.
    dsn,
    // Provide the environment field value.
    environment: import.meta.env.MODE,
    // Default to a low sample rate; override via env for staging/prod tuning.
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // Provide the send default pii field value.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!dsn || !requestId) {
    // Return control to the caller with the following value.
    return;
  }
  // Call Sentry.setTag to perform this step.
  Sentry.setTag('requestId', requestId);
  // Same id is tagged both ways so either search field finds the event.
  Sentry.setTag('correlationId', requestId);
}

// Re-export the listed bindings.
export { Sentry };
