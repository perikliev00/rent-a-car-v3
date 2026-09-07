const client = require('prom-client');

client.collectDefaultMetrics({ register: client.register });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'status_code', 'route'],
});

const httpRequestDurationMs = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'status_code', 'route'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

const paymentFailuresTotal = new client.Counter({
  name: 'payment_failures_total',
  help: 'Total payment failures',
});

const webhookFailuresTotal = new client.Counter({
  name: 'stripe_webhook_failures_total',
  help: 'Total Stripe webhook failures',
  labelNames: ['reason'],
});

const errorsTotal = new client.Counter({
  name: 'errors_total',
  help: 'Total application errors',
});

const checkoutStartedTotal = new client.Counter({
  name: 'checkout_started_total',
  help: 'Checkout sessions started',
});

const checkoutCompletedTotal = new client.Counter({
  name: 'checkout_completed_total',
  help: 'Checkout sessions completed successfully',
});

const checkoutAbandonedTotal = new client.Counter({
  name: 'checkout_abandoned_total',
  help: 'Checkout sessions abandoned or expired',
});

const reservationConflictsTotal = new client.Counter({
  name: 'reservation_conflicts_total',
  help: 'Reservation conflicts',
  labelNames: ['reason'],
});

const adminLoginFailuresTotal = new client.Counter({
  name: 'admin_login_failures_total',
  help: 'Failed admin login attempts',
});

const emailConfirmationFailuresTotal = new client.Counter({
  name: 'email_confirmation_failures_total',
  help: 'Failed booking confirmation emails',
});

const businessEventsTotal = new client.Counter({
  name: 'business_events_total',
  help: 'Business event occurrences',
  labelNames: ['event'],
});

const dbQueryDurationMs = new client.Histogram({
  name: 'db_query_duration_ms',
  help: 'Database query duration in milliseconds',
  labelNames: ['operation'],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
});

const paidNotConfirmedCount = new client.Gauge({
  name: 'paid_not_confirmed_count',
  help: 'Reservations paid but needing manual review',
});

const processingPaidCount = new client.Gauge({
  name: 'processing_paid_count',
  help: 'Reservations stuck in processing_payment with Stripe session',
});

const activeReservationsCount = new client.Gauge({
  name: 'active_reservations_count',
  help: 'Active hold reservations (pending_payment or processing_payment)',
});

const unresolvedPaymentFailuresCount = new client.Gauge({
  name: 'unresolved_payment_failures_count',
  help: 'Unresolved payment failure records',
});

const dbPoolTotal = new client.Gauge({
  name: 'db_pool_total',
  help: 'Database connection pool total connections',
});

const dbPoolIdle = new client.Gauge({
  name: 'db_pool_idle',
  help: 'Database connection pool idle connections',
});

const dbPoolWaiting = new client.Gauge({
  name: 'db_pool_waiting',
  help: 'Database connection pool waiting clients',
});

const readyStatus = new client.Gauge({
  name: 'ready_status',
  help: '1 when /ready checks pass, else 0',
});

const migrationsOk = new client.Gauge({
  name: 'migrations_ok',
  help: '1 when expected migrations are applied, else 0',
});

const migrationsPending = new client.Gauge({
  name: 'migrations_pending',
  help: 'Number of pending SQL migrations',
});

const workerHeartbeatUnixtime = new client.Gauge({
  name: 'worker_heartbeat_unixtime',
  help: 'Unix timestamp of the last worker heartbeat',
});

const backgroundJobFailuresTotal = new client.Counter({
  name: 'background_job_failures_total',
  help: 'Background job failures',
  labelNames: ['job'],
});

const backgroundJobLastSuccessUnixtime = new client.Gauge({
  name: 'background_job_last_success_unixtime',
  help: 'Unix timestamp of the last successful background job run',
  labelNames: ['job'],
});

const storageErrorsTotal = new client.Counter({
  name: 'storage_errors_total',
  help: 'Storage operation failures',
  labelNames: ['driver', 'op'],
});

const storageFreeBytes = new client.Gauge({
  name: 'storage_free_bytes',
  help: 'Free bytes on a monitored storage path',
  labelNames: ['path'],
});

const storageSizeBytes = new client.Gauge({
  name: 'storage_size_bytes',
  help: 'Total bytes on a monitored storage path',
  labelNames: ['path'],
});

const pgDatabaseSizeBytes = new client.Gauge({
  name: 'pg_database_size_bytes',
  help: 'PostgreSQL current database size in bytes',
});

function normalizeRoute(route) {
  if (!route || route === 'unknown') {
    return 'unknown';
  }
  return route.replace(/\/\d+/g, '/:id');
}

function recordRequest(method, path, statusCode, durationMs, route) {
  const normalizedRoute = normalizeRoute(route || path);
  const labels = {
    method: method || 'UNKNOWN',
    status_code: String(statusCode),
    route: normalizedRoute,
  };

  httpRequestsTotal.inc(labels);
  httpRequestDurationMs.observe(labels, durationMs);
}

function recordDbQuery(operation, durationMs) {
  dbQueryDurationMs.observe({ operation: operation || 'query' }, durationMs);
}

function incrementPaymentFailures() {
  paymentFailuresTotal.inc();
}

function incrementWebhookFailures(reason = 'unknown') {
  webhookFailuresTotal.inc({ reason });
}

function incrementErrors() {
  errorsTotal.inc();
}

function incrementCheckoutStarted() {
  checkoutStartedTotal.inc();
}

function incrementCheckoutCompleted() {
  checkoutCompletedTotal.inc();
}

function incrementCheckoutAbandoned() {
  checkoutAbandonedTotal.inc();
}

function incrementReservationConflict(reason) {
  reservationConflictsTotal.inc({ reason: reason || 'unknown' });
}

function incrementAdminLoginFailures() {
  adminLoginFailuresTotal.inc();
}

function incrementEmailConfirmationFailures() {
  emailConfirmationFailuresTotal.inc();
}

function incrementBusinessEvent(event) {
  if (!event) return;
  businessEventsTotal.inc({ event });
}

function setGaugeValues(values) {
  if (values.paidNotConfirmed != null) {
    paidNotConfirmedCount.set(values.paidNotConfirmed);
  }
  if (values.processingPaid != null) {
    processingPaidCount.set(values.processingPaid);
  }
  if (values.activeReservations != null) {
    activeReservationsCount.set(values.activeReservations);
  }
  if (values.unresolvedPaymentFailures != null) {
    unresolvedPaymentFailuresCount.set(values.unresolvedPaymentFailures);
  }
  if (values.dbPoolTotal != null) {
    dbPoolTotal.set(values.dbPoolTotal);
  }
  if (values.dbPoolIdle != null) {
    dbPoolIdle.set(values.dbPoolIdle);
  }
  if (values.dbPoolWaiting != null) {
    dbPoolWaiting.set(values.dbPoolWaiting);
  }
  if (values.readyStatus != null) {
    readyStatus.set(values.readyStatus);
  }
  if (values.migrationsOk != null) {
    migrationsOk.set(values.migrationsOk);
  }
  if (values.migrationsPending != null) {
    migrationsPending.set(values.migrationsPending);
  }
  if (values.storagePaths && typeof values.storagePaths === 'object') {
    for (const [pathLabel, sizes] of Object.entries(values.storagePaths)) {
      if (sizes?.freeBytes != null) {
        storageFreeBytes.set({ path: pathLabel }, sizes.freeBytes);
      }
      if (sizes?.sizeBytes != null) {
        storageSizeBytes.set({ path: pathLabel }, sizes.sizeBytes);
      }
    }
  }
  if (values.pgDatabaseSizeBytes != null) {
    pgDatabaseSizeBytes.set(values.pgDatabaseSizeBytes);
  }
}

function setWorkerHeartbeat(unixtime = Math.floor(Date.now() / 1000)) {
  workerHeartbeatUnixtime.set(unixtime);
}

function incrementBackgroundJobFailure(job) {
  backgroundJobFailuresTotal.inc({ job: job || 'unknown' });
}

function setBackgroundJobLastSuccess(job, unixtime = Math.floor(Date.now() / 1000)) {
  if (!job) return;
  backgroundJobLastSuccessUnixtime.set({ job }, unixtime);
}

function incrementStorageErrors(driver = 'unknown', op = 'unknown') {
  storageErrorsTotal.inc({ driver, op });
}

async function getMetrics() {
  return client.register.metrics();
}

module.exports = {
  recordRequest,
  recordDbQuery,
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
  setGaugeValues,
  setWorkerHeartbeat,
  incrementBackgroundJobFailure,
  setBackgroundJobLastSuccess,
  incrementStorageErrors,
  getMetrics,
};
