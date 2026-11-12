/**
 * In-process metrics facade: keeps a JSON snapshot for `/metrics`-style debugging
 * and forwards counters/histograms to the Prometheus registry.
 */

const startTime = Date.now();
// Require the './prometheus' module as prometheus.
const prometheus = require('./prometheus');

// Create the state constant.
const state = {
  // Provide the requests field value.
  requests: {
    // Provide the total field value.
    total: 0,
    // Provide the by status field value.
    byStatus: {},
    // Provide the by method field value.
    byMethod: {},
    // Provide the total duration ms field value.
    totalDurationMs: 0,
  },
  // Provide the payment failures field value.
  paymentFailures: 0,
  // Provide the webhook failures field value.
  webhookFailures: 0,
  // Provide the errors field value.
  errors: 0,
  // Provide the checkout started field value.
  checkoutStarted: 0,
  // Provide the checkout completed field value.
  checkoutCompleted: 0,
  // Provide the checkout abandoned field value.
  checkoutAbandoned: 0,
};

/**
 * Process uptime in whole seconds since this module was first loaded.
 *
 * @returns {number}
 * @throws {never}
 */
function getUptimeSeconds() {
  // Return the resulting value to the caller.
  return Math.floor((Date.now() - startTime) / 1000);
}

/**
 * Record one HTTP request into the in-memory snapshot and Prometheus.
 *
 * @param {string} method - HTTP method
 * @param {string} path - Request path (may be raw URL path)
 * @param {number|string} statusCode - Response status
 * @param {number} durationMs - Request duration in milliseconds
 * @param {string} [route] - Normalized route template when available
 * @returns {void}
 * @throws {never}
 */
function recordRequest(method, path, statusCode, durationMs, route) {
  // Update in-process counters used by getSnapshot().
  state.requests.total += 1;
  // Update state.requests.totalDurationMs with the right-hand side value.
  state.requests.totalDurationMs += durationMs;

  // Create the status key constant.
  const statusKey = String(statusCode);
  // Update state.requests.byStatus[statusKey] with the right-hand side value.
  state.requests.byStatus[statusKey] = (state.requests.byStatus[statusKey] || 0) + 1;

  // Create the method key constant.
  const methodKey = method || 'UNKNOWN';
  // Update state.requests.byMethod[methodKey] with the right-hand side value.
  state.requests.byMethod[methodKey] = (state.requests.byMethod[methodKey] || 0) + 1;

  // Forward to Prometheus histograms/counters.
  prometheus.recordRequest(method, path, statusCode, durationMs, route);
}

/**
 * Increment the payment-failure counter (in-memory + Prometheus).
 *
 * @returns {void}
 * @throws {never}
 */
function incrementPaymentFailures() {
  // Update state.paymentFailures with the right-hand side value.
  state.paymentFailures += 1;
  // Call prometheus.incrementPaymentFailures to perform this step.
  prometheus.incrementPaymentFailures();
}

/**
 * Increment the webhook-failure counter (in-memory + Prometheus).
 *
 * @param {string} [reason] - Optional failure reason label for Prometheus
 * @returns {void}
 * @throws {never}
 */
function incrementWebhookFailures(reason) {
  // Update state.webhookFailures with the right-hand side value.
  state.webhookFailures += 1;
  // Call prometheus.incrementWebhookFailures to perform this step.
  prometheus.incrementWebhookFailures(reason);
}

/**
 * Increment the generic application-error counter.
 *
 * @returns {void}
 * @throws {never}
 */
function incrementErrors() {
  // Update state.errors with the right-hand side value.
  state.errors += 1;
  // Call prometheus.incrementErrors to perform this step.
  prometheus.incrementErrors();
}

/**
 * Increment checkout-started counter (customer entered checkout).
 *
 * @returns {void}
 * @throws {never}
 */
function incrementCheckoutStarted() {
  // Update state.checkoutStarted with the right-hand side value.
  state.checkoutStarted += 1;
  // Call prometheus.incrementCheckoutStarted to perform this step.
  prometheus.incrementCheckoutStarted();
}

/**
 * Increment checkout-completed counter (successful payment finalization).
 *
 * @returns {void}
 * @throws {never}
 */
function incrementCheckoutCompleted() {
  // Update state.checkoutCompleted with the right-hand side value.
  state.checkoutCompleted += 1;
  // Call prometheus.incrementCheckoutCompleted to perform this step.
  prometheus.incrementCheckoutCompleted();
}

/**
 * Increment checkout-abandoned counter by `count` (default 1).
 *
 * @param {number} [count=1] - Number of abandons to record
 * @returns {void}
 * @throws {never}
 */
function incrementCheckoutAbandoned(count = 1) {
  // Update state.checkoutAbandoned with the right-hand side value.
  state.checkoutAbandoned += count;
  // Prometheus counter has no bulk helper — tick once per abandon.
  for (let i = 0; i < count; i += 1) {
    // Call prometheus.incrementCheckoutAbandoned to perform this step.
    prometheus.incrementCheckoutAbandoned();
  }
}

/**
 * Increment reservation-conflict counter (overlap / exclusion hits).
 *
 * @param {string} [reason] - Optional conflict reason label
 * @returns {void}
 * @throws {never}
 */
function incrementReservationConflict(reason) {
  // Call prometheus.incrementReservationConflict to perform this step.
  prometheus.incrementReservationConflict(reason);
}

/**
 * Increment failed admin login attempts.
 *
 * @returns {void}
 * @throws {never}
 */
function incrementAdminLoginFailures() {
  // Call prometheus.incrementAdminLoginFailures to perform this step.
  prometheus.incrementAdminLoginFailures();
}

/**
 * Increment failed customer email-confirmation attempts.
 *
 * @returns {void}
 * @throws {never}
 */
function incrementEmailConfirmationFailures() {
  // Call prometheus.incrementEmailConfirmationFailures to perform this step.
  prometheus.incrementEmailConfirmationFailures();
}

/**
 * Increment a named business-event counter (used by logEvent).
 *
 * @param {string} event - Stable event name / label
 * @returns {void}
 * @throws {never}
 */
function incrementBusinessEvent(event) {
  // Call prometheus.incrementBusinessEvent to perform this step.
  prometheus.incrementBusinessEvent(event);
}

/**
 * Record a DB query duration sample.
 *
 * @param {string} operation - SQL verb (select/insert/…)
 * @param {number} durationMs - Query duration in milliseconds
 * @returns {void}
 * @throws {never}
 */
function recordDbQuery(operation, durationMs) {
  // Call prometheus.recordDbQuery to perform this step.
  prometheus.recordDbQuery(operation, durationMs);
}

/**
 * Push a batch of gauge values into Prometheus.
 *
 * @param {Record<string, unknown>} values - Gauge payload from the poller
 * @returns {void}
 * @throws {never}
 */
function setGaugeValues(values) {
  // Call prometheus.setGaugeValues to perform this step.
  prometheus.setGaugeValues(values);
}

/**
 * Update the worker heartbeat unix timestamp gauge.
 *
 * @param {number} [unixtime] - Seconds since epoch; defaults inside Prometheus helper
 * @returns {void}
 * @throws {never}
 */
function setWorkerHeartbeat(unixtime) {
  // Call prometheus.setWorkerHeartbeat to perform this step.
  prometheus.setWorkerHeartbeat(unixtime);
}

/**
 * Increment background-job failure counter for a job key.
 *
 * @param {string} job - Job lock key / name
 * @returns {void}
 * @throws {never}
 */
function incrementBackgroundJobFailure(job) {
  // Call prometheus.incrementBackgroundJobFailure to perform this step.
  prometheus.incrementBackgroundJobFailure(job);
}

/**
 * Record last-success unix time for a background job.
 *
 * @param {string} job - Job lock key / name
 * @param {number} [unixtime] - Seconds since epoch
 * @returns {void}
 * @throws {never}
 */
function setBackgroundJobLastSuccess(job, unixtime) {
  // Call prometheus.setBackgroundJobLastSuccess to perform this step.
  prometheus.setBackgroundJobLastSuccess(job, unixtime);
}

/**
 * Increment storage/driver error counter.
 *
 * @param {string} [driver] - Storage driver label
 * @param {string} [op] - Operation label
 * @returns {void}
 * @throws {never}
 */
function incrementStorageErrors(driver, op) {
  // Call prometheus.incrementStorageErrors to perform this step.
  prometheus.incrementStorageErrors(driver, op);
}

/**
 * JSON snapshot of in-memory counters (not the Prometheus text format).
 *
 * @returns {object} Uptime, request aggregates, payment/checkout counters
 * @throws {never}
 */
function getSnapshot() {
  // Average duration from cumulative totals (0 when no requests yet).
  const avgDurationMs =
    // Continue the surrounding logic with this statement.
    state.requests.total > 0
      // Continue the surrounding logic with this statement.
      ? Math.round((state.requests.totalDurationMs / state.requests.total) * 100) / 100
      // Contribute this line to the enclosing declaration or statement.
      : 0;

  // Return the resulting value to the caller.
  return {
    // Provide the uptime seconds field value.
    uptimeSeconds: getUptimeSeconds(),
    // Provide the started at field value.
    startedAt: new Date(startTime).toISOString(),
    // Provide the requests field value.
    requests: {
      // Provide the total field value.
      total: state.requests.total,
      // Contribute this line to the enclosing declaration or statement.
      avgDurationMs,
      // Provide the by status field value.
      byStatus: { ...state.requests.byStatus },
      // Provide the by method field value.
      byMethod: { ...state.requests.byMethod },
    },
    // Provide the payment failures field value.
    paymentFailures: state.paymentFailures,
    // Provide the webhook failures field value.
    webhookFailures: state.webhookFailures,
    // Provide the errors field value.
    errors: state.errors,
    // Provide the checkout field value.
    checkout: {
      // Provide the started field value.
      started: state.checkoutStarted,
      // Provide the completed field value.
      completed: state.checkoutCompleted,
      // Provide the abandoned field value.
      abandoned: state.checkoutAbandoned,
    },
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getUptimeSeconds,
  // Contribute this line to the enclosing declaration or statement.
  recordRequest,
  // Contribute this line to the enclosing declaration or statement.
  incrementPaymentFailures,
  // Contribute this line to the enclosing declaration or statement.
  incrementWebhookFailures,
  // Contribute this line to the enclosing declaration or statement.
  incrementErrors,
  // Contribute this line to the enclosing declaration or statement.
  incrementCheckoutStarted,
  // Contribute this line to the enclosing declaration or statement.
  incrementCheckoutCompleted,
  // Contribute this line to the enclosing declaration or statement.
  incrementCheckoutAbandoned,
  // Contribute this line to the enclosing declaration or statement.
  incrementReservationConflict,
  // Contribute this line to the enclosing declaration or statement.
  incrementAdminLoginFailures,
  // Contribute this line to the enclosing declaration or statement.
  incrementEmailConfirmationFailures,
  // Contribute this line to the enclosing declaration or statement.
  incrementBusinessEvent,
  // Contribute this line to the enclosing declaration or statement.
  recordDbQuery,
  // Contribute this line to the enclosing declaration or statement.
  setGaugeValues,
  // Contribute this line to the enclosing declaration or statement.
  setWorkerHeartbeat,
  // Contribute this line to the enclosing declaration or statement.
  incrementBackgroundJobFailure,
  // Contribute this line to the enclosing declaration or statement.
  setBackgroundJobLastSuccess,
  // Contribute this line to the enclosing declaration or statement.
  incrementStorageErrors,
  // Contribute this line to the enclosing declaration or statement.
  getSnapshot,
  // Provide the get prometheus metrics field value.
  getPrometheusMetrics: prometheus.getMetrics,
};
