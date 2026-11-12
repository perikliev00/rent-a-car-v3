/**
 * Prometheus metric definitions and recording helpers for HTTP, DB, payments, and jobs.
 */

const client = require('prom-client');

// Call client.collectDefaultMetrics to perform this step.
client.collectDefaultMetrics({ register: client.register });

// Create the http requests total constant.
const httpRequestsTotal = new client.Counter({
  // Provide the name field value.
  name: 'http_requests_total',
  // Provide the help field value.
  help: 'Total HTTP requests',
  // Provide the label names field value.
  labelNames: ['method', 'status_code', 'route'],
});

// Create the http request duration ms constant.
const httpRequestDurationMs = new client.Histogram({
  // Provide the name field value.
  name: 'http_request_duration_ms',
  // Provide the help field value.
  help: 'HTTP request duration in milliseconds',
  // Provide the label names field value.
  labelNames: ['method', 'status_code', 'route'],
  // Provide the buckets field value.
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

// Create the payment failures total constant.
const paymentFailuresTotal = new client.Counter({
  // Provide the name field value.
  name: 'payment_failures_total',
  // Provide the help field value.
  help: 'Total payment failures',
});

// Create the webhook failures total constant.
const webhookFailuresTotal = new client.Counter({
  // Provide the name field value.
  name: 'stripe_webhook_failures_total',
  // Provide the help field value.
  help: 'Total Stripe webhook failures',
  // Provide the label names field value.
  labelNames: ['reason'],
});

// Create the errors total constant.
const errorsTotal = new client.Counter({
  // Provide the name field value.
  name: 'errors_total',
  // Provide the help field value.
  help: 'Total application errors',
});

// Create the checkout started total constant.
const checkoutStartedTotal = new client.Counter({
  // Provide the name field value.
  name: 'checkout_started_total',
  // Provide the help field value.
  help: 'Checkout sessions started',
});

// Create the checkout completed total constant.
const checkoutCompletedTotal = new client.Counter({
  // Provide the name field value.
  name: 'checkout_completed_total',
  // Provide the help field value.
  help: 'Checkout sessions completed successfully',
});

// Create the checkout abandoned total constant.
const checkoutAbandonedTotal = new client.Counter({
  // Provide the name field value.
  name: 'checkout_abandoned_total',
  // Provide the help field value.
  help: 'Checkout sessions abandoned or expired',
});

// Create the reservation conflicts total constant.
const reservationConflictsTotal = new client.Counter({
  // Provide the name field value.
  name: 'reservation_conflicts_total',
  // Provide the help field value.
  help: 'Reservation conflicts',
  // Provide the label names field value.
  labelNames: ['reason'],
});

// Create the admin login failures total constant.
const adminLoginFailuresTotal = new client.Counter({
  // Provide the name field value.
  name: 'admin_login_failures_total',
  // Provide the help field value.
  help: 'Failed admin login attempts',
});

// Create the email confirmation failures total constant.
const emailConfirmationFailuresTotal = new client.Counter({
  // Provide the name field value.
  name: 'email_confirmation_failures_total',
  // Provide the help field value.
  help: 'Failed booking confirmation emails',
});

// Create the business events total constant.
const businessEventsTotal = new client.Counter({
  // Provide the name field value.
  name: 'business_events_total',
  // Provide the help field value.
  help: 'Business event occurrences',
  // Provide the label names field value.
  labelNames: ['event'],
});

// Create the db query duration ms constant.
const dbQueryDurationMs = new client.Histogram({
  // Provide the name field value.
  name: 'db_query_duration_ms',
  // Provide the help field value.
  help: 'Database query duration in milliseconds',
  // Provide the label names field value.
  labelNames: ['operation'],
  // Provide the buckets field value.
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
});

// Create the paid not confirmed count constant.
const paidNotConfirmedCount = new client.Gauge({
  // Provide the name field value.
  name: 'paid_not_confirmed_count',
  // Provide the help field value.
  help: 'Reservations paid but needing manual review',
});

// Create the processing paid count constant.
const processingPaidCount = new client.Gauge({
  // Provide the name field value.
  name: 'processing_paid_count',
  // Provide the help field value.
  help: 'Reservations stuck in processing_payment with Stripe session',
});

// Create the active reservations count constant.
const activeReservationsCount = new client.Gauge({
  // Provide the name field value.
  name: 'active_reservations_count',
  // Provide the help field value.
  help: 'Active hold reservations (pending_payment or processing_payment)',
});

// Create the unresolved payment failures count constant.
const unresolvedPaymentFailuresCount = new client.Gauge({
  // Provide the name field value.
  name: 'unresolved_payment_failures_count',
  // Provide the help field value.
  help: 'Unresolved payment failure records',
});

// Create the db pool total constant.
const dbPoolTotal = new client.Gauge({
  // Provide the name field value.
  name: 'db_pool_total',
  // Provide the help field value.
  help: 'Database connection pool total connections',
});

// Create the db pool idle constant.
const dbPoolIdle = new client.Gauge({
  // Provide the name field value.
  name: 'db_pool_idle',
  // Provide the help field value.
  help: 'Database connection pool idle connections',
});

// Create the db pool waiting constant.
const dbPoolWaiting = new client.Gauge({
  // Provide the name field value.
  name: 'db_pool_waiting',
  // Provide the help field value.
  help: 'Database connection pool waiting clients',
});

// Create the ready status constant.
const readyStatus = new client.Gauge({
  // Provide the name field value.
  name: 'ready_status',
  // Provide the help field value.
  help: '1 when /ready checks pass, else 0',
});

// Create the migrations ok constant.
const migrationsOk = new client.Gauge({
  // Provide the name field value.
  name: 'migrations_ok',
  // Provide the help field value.
  help: '1 when expected migrations are applied, else 0',
});

// Create the migrations pending constant.
const migrationsPending = new client.Gauge({
  // Provide the name field value.
  name: 'migrations_pending',
  // Provide the help field value.
  help: 'Number of pending SQL migrations',
});

// Create the worker heartbeat unixtime constant.
const workerHeartbeatUnixtime = new client.Gauge({
  // Provide the name field value.
  name: 'worker_heartbeat_unixtime',
  // Provide the help field value.
  help: 'Unix timestamp of the last worker heartbeat',
});

// Create the background job failures total constant.
const backgroundJobFailuresTotal = new client.Counter({
  // Provide the name field value.
  name: 'background_job_failures_total',
  // Provide the help field value.
  help: 'Background job failures',
  // Provide the label names field value.
  labelNames: ['job'],
});

// Create the background job last success unixtime constant.
const backgroundJobLastSuccessUnixtime = new client.Gauge({
  // Provide the name field value.
  name: 'background_job_last_success_unixtime',
  // Provide the help field value.
  help: 'Unix timestamp of the last successful background job run',
  // Provide the label names field value.
  labelNames: ['job'],
});

// Create the storage errors total constant.
const storageErrorsTotal = new client.Counter({
  // Provide the name field value.
  name: 'storage_errors_total',
  // Provide the help field value.
  help: 'Storage operation failures',
  // Provide the label names field value.
  labelNames: ['driver', 'op'],
});

// Create the storage free bytes constant.
const storageFreeBytes = new client.Gauge({
  // Provide the name field value.
  name: 'storage_free_bytes',
  // Provide the help field value.
  help: 'Free bytes on a monitored storage path',
  // Provide the label names field value.
  labelNames: ['path'],
});

// Create the storage size bytes constant.
const storageSizeBytes = new client.Gauge({
  // Provide the name field value.
  name: 'storage_size_bytes',
  // Provide the help field value.
  help: 'Total bytes on a monitored storage path',
  // Provide the label names field value.
  labelNames: ['path'],
});

// Create the pg database size bytes constant.
const pgDatabaseSizeBytes = new client.Gauge({
  // Provide the name field value.
  name: 'pg_database_size_bytes',
  // Provide the help field value.
  help: 'PostgreSQL current database size in bytes',
});

/**
 * Collapse numeric path segments to `:id` for low-cardinality Prometheus route labels.
 *
 * @param {string} [route] - Raw route or path
 * @returns {string} Normalized route label (`unknown` when empty)
 * @throws {never}
 */
function normalizeRoute(route) {
  // Evaluate the condition and enter the branch when it is true.
  if (!route || route === 'unknown') {
    // Return the resulting value to the caller.
    return 'unknown';
  }
  // Replace /123 segments so each id does not create a new time series.
  return route.replace(/\/\d+/g, '/:id');
}

/**
 * Record one HTTP request (counter + duration histogram).
 *
 * @param {string} method
 * @param {string} path
 * @param {number|string} statusCode
 * @param {number} durationMs
 * @param {string} [route]
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function recordRequest(method, path, statusCode, durationMs, route) {
  // Create the normalized route constant.
  const normalizedRoute = normalizeRoute(route || path);
  // Create the labels constant.
  const labels = {
    // Provide the method field value.
    method: method || 'UNKNOWN',
    // Provide the status code field value.
    status_code: String(statusCode),
    // Provide the route field value.
    route: normalizedRoute,
  };

  // Call httpRequestsTotal.inc to perform this step.
  httpRequestsTotal.inc(labels);
  // Call httpRequestDurationMs.observe to perform this step.
  httpRequestDurationMs.observe(labels, durationMs);
}

/**
 * @param {string} operation - SQL verb or logical op name
 * @param {number} durationMs
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function recordDbQuery(operation, durationMs) {
  // Call dbQueryDurationMs.observe to perform this step.
  dbQueryDurationMs.observe({ operation: operation || 'query' }, durationMs);
}

/**
 * Increment the payment-failures counter.
 *
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementPaymentFailures() {
  // Call paymentFailuresTotal.inc to perform this step.
  paymentFailuresTotal.inc();
}

/**
 * Increment the Stripe webhook-failures counter.
 *
 * @param {*} [reason] - reason = 'unknown'
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementWebhookFailures(reason = 'unknown') {
  // Call webhookFailuresTotal.inc to perform this step.
  webhookFailuresTotal.inc({ reason });
}

/**
 * Increment the application-errors counter.
 *
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementErrors() {
  // Call errorsTotal.inc to perform this step.
  errorsTotal.inc();
}

/**
 * Increment the checkout-started counter.
 *
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementCheckoutStarted() {
  // Call checkoutStartedTotal.inc to perform this step.
  checkoutStartedTotal.inc();
}

/**
 * Increment the checkout-completed counter.
 *
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementCheckoutCompleted() {
  // Call checkoutCompletedTotal.inc to perform this step.
  checkoutCompletedTotal.inc();
}

/**
 * Increment the checkout-abandoned counter.
 *
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementCheckoutAbandoned() {
  // Call checkoutAbandonedTotal.inc to perform this step.
  checkoutAbandonedTotal.inc();
}

/**
 * Increment the reservation-conflicts counter.
 *
 * @param {*} reason
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementReservationConflict(reason) {
  // Call reservationConflictsTotal.inc to perform this step.
  reservationConflictsTotal.inc({ reason: reason || 'unknown' });
}

/**
 * Increment the admin-login-failures counter.
 *
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementAdminLoginFailures() {
  // Call adminLoginFailuresTotal.inc to perform this step.
  adminLoginFailuresTotal.inc();
}

/**
 * Increment the email-confirmation-failures counter.
 *
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementEmailConfirmationFailures() {
  // Call emailConfirmationFailuresTotal.inc to perform this step.
  emailConfirmationFailuresTotal.inc();
}

/**
 * Increment a named business-event counter.
 *
 * @param {*} event
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementBusinessEvent(event) {
  // Evaluate the condition and enter the branch when it is true.
  if (!event) return;
  // Call businessEventsTotal.inc to perform this step.
  businessEventsTotal.inc({ event });
}

/**
 * Update operational gauges from a polled snapshot object.
 * @param {Record<string, unknown>} values
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function setGaugeValues(values) {
  // Evaluate the condition and enter the branch when it is true.
  if (values.paidNotConfirmed != null) {
    // Call paidNotConfirmedCount.set to perform this step.
    paidNotConfirmedCount.set(values.paidNotConfirmed);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.processingPaid != null) {
    // Call processingPaidCount.set to perform this step.
    processingPaidCount.set(values.processingPaid);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.activeReservations != null) {
    // Call activeReservationsCount.set to perform this step.
    activeReservationsCount.set(values.activeReservations);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.unresolvedPaymentFailures != null) {
    // Call unresolvedPaymentFailuresCount.set to perform this step.
    unresolvedPaymentFailuresCount.set(values.unresolvedPaymentFailures);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.dbPoolTotal != null) {
    // Call dbPoolTotal.set to perform this step.
    dbPoolTotal.set(values.dbPoolTotal);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.dbPoolIdle != null) {
    // Call dbPoolIdle.set to perform this step.
    dbPoolIdle.set(values.dbPoolIdle);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.dbPoolWaiting != null) {
    // Call dbPoolWaiting.set to perform this step.
    dbPoolWaiting.set(values.dbPoolWaiting);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.readyStatus != null) {
    // Call readyStatus.set to perform this step.
    readyStatus.set(values.readyStatus);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.migrationsOk != null) {
    // Call migrationsOk.set to perform this step.
    migrationsOk.set(values.migrationsOk);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.migrationsPending != null) {
    // Call migrationsPending.set to perform this step.
    migrationsPending.set(values.migrationsPending);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.storagePaths && typeof values.storagePaths === 'object') {
    // Iterate using the loop initializer, condition, and step.
    for (const [pathLabel, sizes] of Object.entries(values.storagePaths)) {
      // Evaluate the condition and enter the branch when it is true.
      if (sizes?.freeBytes != null) {
        // Call storageFreeBytes.set to perform this step.
        storageFreeBytes.set({ path: pathLabel }, sizes.freeBytes);
      }
      // Evaluate the condition and enter the branch when it is true.
      if (sizes?.sizeBytes != null) {
        // Call storageSizeBytes.set to perform this step.
        storageSizeBytes.set({ path: pathLabel }, sizes.sizeBytes);
      }
    }
  }
  // Evaluate the condition and enter the branch when it is true.
  if (values.pgDatabaseSizeBytes != null) {
    // Call pgDatabaseSizeBytes.set to perform this step.
    pgDatabaseSizeBytes.set(values.pgDatabaseSizeBytes);
  }
}

/**
 * Set the worker heartbeat unix-timestamp gauge.
 *
 * @param {*} [unixtime] - unixtime = Math.floor(Date.now() / 1000)
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function setWorkerHeartbeat(unixtime = Math.floor(Date.now() / 1000)) {
  // Call workerHeartbeatUnixtime.set to perform this step.
  workerHeartbeatUnixtime.set(unixtime);
}

/**
 * Increment the background-job-failures counter for a job key.
 *
 * @param {*} job
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementBackgroundJobFailure(job) {
  // Call backgroundJobFailuresTotal.inc to perform this step.
  backgroundJobFailuresTotal.inc({ job: job || 'unknown' });
}

/**
 * Set the last-success unix timestamp for a background job.
 *
 * @param {*} job
 * @param {*} [unixtime] - unixtime = Math.floor(Date.now() / 1000)
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function setBackgroundJobLastSuccess(job, unixtime = Math.floor(Date.now() / 1000)) {
  // Evaluate the condition and enter the branch when it is true.
  if (!job) return;
  // Call backgroundJobLastSuccessUnixtime.set to perform this step.
  backgroundJobLastSuccessUnixtime.set({ job }, unixtime);
}

/**
 * Increment the storage-errors counter.
 *
 * @param {*} [driver] - driver = 'unknown'
 * @param {*} [op] - op = 'unknown'
 * @returns {*}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function incrementStorageErrors(driver = 'unknown', op = 'unknown') {
  // Call storageErrorsTotal.inc to perform this step.
  storageErrorsTotal.inc({ driver, op });
}

/**
 * Serialize the default Prometheus registry for the `/metrics` scrape endpoint.
 *
 * @returns {Promise<string>} Prometheus text exposition format
 * @throws {Error} Propagates registry serialization failures
 */
async function getMetrics() {
  // Return the resulting value to the caller.
  return client.register.metrics();
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  recordRequest,
  // Contribute this line to the enclosing declaration or statement.
  recordDbQuery,
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
  getMetrics,
};
