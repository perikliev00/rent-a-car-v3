const Sentry = require('@sentry/node');

let enabled = false;

function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  const SENSITIVE_KEY_PATTERN = /password|secret|token|cookie|authorization|email|phone|address/i;

  function scrubValue(value) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'string') {
      return '[Redacted]';
    }

    if (Array.isArray(value)) {
      return value.map(scrubValue);
    }

    if (typeof value === 'object') {
      return scrubObject(value);
    }

    return value;
  }

  function scrubObject(obj) {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? '[Redacted]' : scrubValue(value),
      ])
    );
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    beforeSend(event) {
      if (event.request) {
        event.request = scrubObject(event.request);
      }

      if (event.extra) {
        event.extra = scrubObject(event.extra);
      }

      return event;
    },
  });

  enabled = true;
}

function captureException(error, options = {}) {
  if (!enabled || !error) {
    return;
  }

  Sentry.withScope((scope) => {
    if (options.tags) {
      Object.entries(options.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (options.extra) {
      scope.setContext('extra', options.extra);
    }

    if (options.correlationId) {
      scope.setTag('correlationId', options.correlationId);
    }

    Sentry.captureException(error);
  });
}

function captureMessage(message, level = 'warning', options = {}) {
  if (!enabled) {
    return;
  }

  Sentry.withScope((scope) => {
    if (options.tags) {
      Object.entries(options.tags).forEach(([key, value]) => {
        scope.setTag(key, value);
      });
    }

    if (options.extra) {
      scope.setContext('extra', options.extra);
    }

    Sentry.captureMessage(message, level);
  });
}

function isEnabled() {
  return enabled;
}

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  isEnabled,
};
