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
  // Create the dsn constant.
  const dsn = process.env.SENTRY_DSN;
  // Evaluate the condition and enter the branch when it is true.
  if (!dsn) {
    // Return control to the caller with the following value.
    return;
  }

  // Create the sensitive key pattern constant.
  const SENSITIVE_KEY_PATTERN = /password|secret|token|cookie|authorization|email|phone|address/i;

  /**
   * Redact nested values whose keys match sensitive patterns.
   * Strings under a sensitive key become `[Redacted]`; other structures recurse.
   * @param {*} value - Arbitrary nested value from a Sentry event
   * @returns {*} Scrubbed copy suitable for outbound reporting
   */
  function scrubValue(value) {
    // Evaluate the condition and enter the branch when it is true.
    if (value === null || value === undefined) {
      // Return the resulting value to the caller.
      return value;
    }

    // Leaf strings under a sensitive key are fully replaced.
    if (typeof value === 'string') {
      // Return the resulting value to the caller.
      return '[Redacted]';
    }

    // Evaluate the condition and enter the branch when it is true.
    if (Array.isArray(value)) {
      // Return the resulting value to the caller.
      return value.map(scrubValue);
    }

    // Evaluate the condition and enter the branch when it is true.
    if (typeof value === 'object') {
      // Return the resulting value to the caller.
      return scrubObject(value);
    }

    // Return the resulting value to the caller.
    return value;
  }

  /**
   * Scrub an object's own enumerable entries by key name.
   * @param {object|null|undefined} obj - Plain object to scrub
   * @returns {object|null|undefined} New object with sensitive fields redacted
   */
  function scrubObject(obj) {
    // Evaluate the condition and enter the branch when it is true.
    if (!obj || typeof obj !== 'object') {
      // Return the resulting value to the caller.
      return obj;
    }

    // Return the resulting value to the caller.
    return Object.fromEntries(
      // Call Object.entries to perform this step.
      Object.entries(obj).map(([key, value]) => [
        // Contribute this line to the enclosing declaration or statement.
        key,
        // Call SENSITIVE_KEY_PATTERN.test to perform this step.
        SENSITIVE_KEY_PATTERN.test(key) ? '[Redacted]' : scrubValue(value),
      ])
    );
  }

  // Call Sentry.init to perform this step.
  Sentry.init({
    // Contribute this line to the enclosing declaration or statement.
    dsn,
    // Provide the environment field value.
    environment: process.env.NODE_ENV || 'development',
    // Provide the traces sample rate field value.
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // Call beforeSend to perform this step.
    beforeSend(event) {
      // Strip PII from request context attached by the SDK.
      if (event.request) {
        // Update event.request with the right-hand side value.
        event.request = scrubObject(event.request);
      }

      // Evaluate the condition and enter the branch when it is true.
      if (event.extra) {
        // Update event.extra with the right-hand side value.
        event.extra = scrubObject(event.extra);
      }

      // Return the resulting value to the caller.
      return event;
    },
  });

  // Update enabled with the right-hand side value.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!enabled || !error) {
    // Return control to the caller with the following value.
    return;
  }

  // Call Sentry.withScope to perform this step.
  Sentry.withScope((scope) => {
    // Evaluate the condition and enter the branch when it is true.
    if (options.tags) {
      // Call Object.entries to perform this step.
      Object.entries(options.tags).forEach(([key, value]) => {
        // Call scope.setTag to perform this step.
        scope.setTag(key, value);
      });
    }

    // Evaluate the condition and enter the branch when it is true.
    if (options.extra) {
      // Call scope.setContext to perform this step.
      scope.setContext('extra', options.extra);
    }

    // Evaluate the condition and enter the branch when it is true.
    if (options.correlationId) {
      // Call scope.setTag to perform this step.
      scope.setTag('correlationId', options.correlationId);
    }

    // Call Sentry.captureException to perform this step.
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
  // Evaluate the condition and enter the branch when it is true.
  if (!enabled) {
    // Return control to the caller with the following value.
    return;
  }

  // Call Sentry.withScope to perform this step.
  Sentry.withScope((scope) => {
    // Evaluate the condition and enter the branch when it is true.
    if (options.tags) {
      // Call Object.entries to perform this step.
      Object.entries(options.tags).forEach(([key, value]) => {
        // Call scope.setTag to perform this step.
        scope.setTag(key, value);
      });
    }

    // Evaluate the condition and enter the branch when it is true.
    if (options.extra) {
      // Call scope.setContext to perform this step.
      scope.setContext('extra', options.extra);
    }

    // Call Sentry.captureMessage to perform this step.
    Sentry.captureMessage(message, level);
  });
}

/**
 * Whether Sentry was initialized with a DSN for this process.
 * @returns {boolean}
 */
function isEnabled() {
  // Return the resulting value to the caller.
  return enabled;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  initSentry,
  // Contribute this line to the enclosing declaration or statement.
  captureException,
  // Contribute this line to the enclosing declaration or statement.
  captureMessage,
  // Contribute this line to the enclosing declaration or statement.
  isEnabled,
};
