/**
 * Optional Sentry error reporting. No-ops when `SENTRY_DSN` is unset.
 * Sensitive request/extra fields are redacted before events are sent.
 */
const Sentry = require('@sentry/node');

/** True after a successful `initSentry()` with a DSN. */
let enabled = false;

/**
 * Initialize Sentry when `SENTRY_DSN` is present; otherwise leave reporting disabled.
 * Side effects: may call `Sentry.init` and set module-level `enabled`.
 * @returns {void}
 */
function initSentry() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    return;
  }

  const SENSITIVE_KEY_PATTERN = /password|secret|token|cookie|authorization|email|phone|address/i;

  /**
   * Redact nested values whose keys match sensitive patterns.
   * Strings under a sensitive key become `[Redacted]`; other structures recurse.
   * @param {*} value - Arbitrary nested value from a Sentry event
   * @returns {*} Scrubbed copy suitable for outbound reporting
   */
  function scrubValue(value) {
    if (value === null || value === undefined) {
      return value;
    }

    // Leaf strings under a sensitive key are fully replaced.
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

  /**
   * Scrub an object's own enumerable entries by key name.
   * @param {object|null|undefined} obj - Plain object to scrub
   * @returns {object|null|undefined} New object with sensitive fields redacted
   */
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
      // Strip PII from request context attached by the SDK.
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

/**
 * Report an exception to Sentry when enabled.
 * Side effects: may send an event to Sentry.
 * @param {Error} error - Exception to capture
 * @param {{ tags?: object, extra?: object, correlationId?: string }} [options] - Scope enrichment
 * @returns {void}
 */
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

/**
 * Report a message to Sentry when enabled.
 * Side effects: may send an event to Sentry.
 * @param {string} message - Human-readable message
 * @param {string} [level='warning'] - Sentry severity level
 * @param {{ tags?: object, extra?: object }} [options] - Scope enrichment
 * @returns {void}
 */
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

/**
 * Whether Sentry was initialized with a DSN for this process.
 * @returns {boolean}
 */
function isEnabled() {
  return enabled;
}

module.exports = {
  initSentry,
  captureException,
  captureMessage,
  isEnabled,
};
