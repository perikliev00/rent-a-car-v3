import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN;

export function initSentry() {
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    tracesSampleRate: Number(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE || 0.1),
    sendDefaultPii: false,
  });
}

export function setSentryRequestId(requestId: string | null) {
  if (!dsn || !requestId) {
    return;
  }
  Sentry.setTag('requestId', requestId);
  Sentry.setTag('correlationId', requestId);
}

export { Sentry };
