/**
 * In-process metrics facade: keeps a JSON snapshot for `/metrics`-style debugging
 * and forwards counters/histograms to the Prometheus registry.
 */

const startTime = Date.now();
const prometheus = require('./prometheus');

const state = {
  requests: {
    total: 0,
    byStatus: {},
    byMethod: {},
    totalDurationMs: 0,
  },
  paymentFailures: 0,
  webhookFailures: 0,
  errors: 0,
  checkoutStarted: 0,
  checkoutCompleted: 0,
  checkoutAbandoned: 0,
};

/**
 * Process uptime in whole seconds since this module was first loaded.
 *
 * @returns {number}
 * @throws {never}
 */
function getUptimeSeconds() {
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
  state.requests.totalDurationMs += durationMs;

  const statusKey = String(statusCode);
  state.requests.byStatus[statusKey] = (state.requests.byStatus[statusKey] || 0) + 1;

  const methodKey = method || 'UNKNOWN';
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
  state.paymentFailures += 1;
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
  state.webhookFailures += 1;
  prometheus.incrementWebhookFailures(reason);
}

/**
 * Increment the generic application-error counter.
 *
 * @returns {void}
 * @throws {never}
 */
function incrementErrors() {
  state.errors += 1;
  prometheus.incrementErrors();
}

/**
 * Increment checkout-started counter (customer entered checkout).
 *
 * @returns {void}
 * @throws {never}
 */
function incrementCheckoutStarted() {
  state.checkoutStarted += 1;
  prometheus.incrementCheckoutStarted();
}

/**
 * Increment checkout-completed counter (successful payment finalization).
 *
 * @returns {void}
 * @throws {never}
 */
function incrementCheckoutCompleted() {
  state.checkoutCompleted += 1;
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
  state.checkoutAbandoned += count;
  // Prometheus counter has no bulk helper — tick once per abandon.
  for (let i = 0; i < count; i += 1) {
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
  prometheus.incrementReservationConflict(reason);
}

/**
 * Increment failed admin login attempts.
 *
 * @returns {void}
 * @throws {never}
 */
function incrementAdminLoginFailures() {
  prometheus.incrementAdminLoginFailures();
}

/**
 * Increment failed customer email-confirmation attempts.
 *
 * @returns {void}
 * @throws {never}
 */
function incrementEmailConfirmationFailures() {
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
    state.requests.total > 0
      ? Math.round((state.requests.totalDurationMs / state.requests.total) * 100) / 100
      : 0;

  return {
    uptimeSeconds: getUptimeSeconds(),
    startedAt: new Date(startTime).toISOString(),
    requests: {
      total: state.requests.total,
      avgDurationMs,
      byStatus: { ...state.requests.byStatus },
      byMethod: { ...state.requests.byMethod },
    },
    paymentFailures: state.paymentFailures,
    webhookFailures: state.webhookFailures,
    errors: state.errors,
    checkout: {
      started: state.checkoutStarted,
      completed: state.checkoutCompleted,
      abandoned: state.checkoutAbandoned,
    },
  };
}

module.exports = {
  getUptimeSeconds,
  recordRequest,
  incrementPaymentFailures,
  incrementWebhookFailures,
  incrementErrors,
  incrementCheckoutStarted,
  incrementCheckoutCompleted,
  incrementCheckoutAbandoned,
  incrementReservationConflict,
  incrementAdminLoginFailures,
  incrementEmailConfirmationFailures,
  incrementBusinessEvent,
  recordDbQuery,
  setGaugeValues,
  setWorkerHeartbeat,
  incrementBackgroundJobFailure,
  setBackgroundJobLastSuccess,
  incrementStorageErrors,
  getSnapshot,
  getPrometheusMetrics: prometheus.getMetrics,
};
