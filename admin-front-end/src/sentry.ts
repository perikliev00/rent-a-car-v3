/**
 * Optional Sentry init and request/correlation id tagging for API error tracing.
 */
import * as Sentry from '@sentry/react';

// Create the dsn constant.
const dsn = import.meta.env.VITE_SENTRY_DSN;

/**
 * Initialize Sentry when `VITE_SENTRY_DSN` is set; no-op otherwise.
 */
export function initSentry() {
  // Skip entirely in local/dev builds without a DSN.
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
    // Default 10% sampling unless overridden by env.
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // Provide the send default pii field value.
    sendDefaultPii: false,
  });
}

/**
 * Tag the current Sentry scope with the backend request/correlation id.
 * No-op when Sentry is disabled or the id is missing.
 *
 * @param requestId - Value from `X-Request-Id` / `X-Correlation-Id`
 */
export function setSentryRequestId(requestId: string | null) {
  // Evaluate the condition and enter the branch when it is true.
  if (!dsn || !requestId) {
    // Return control to the caller with the following value.
    return;
  }
  // Call Sentry.setTag to perform this step.
  Sentry.setTag('requestId', requestId);
  // Same value under both names for dashboards that filter either tag.
  Sentry.setTag('correlationId', requestId);
}

// Re-export the listed bindings.
export { Sentry };
