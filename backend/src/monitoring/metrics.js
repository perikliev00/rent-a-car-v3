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

function getUptimeSeconds() {
  return Math.floor((Date.now() - startTime) / 1000);
}

function recordRequest(method, path, statusCode, durationMs, route) {
  state.requests.total += 1;
  state.requests.totalDurationMs += durationMs;

  const statusKey = String(statusCode);
  state.requests.byStatus[statusKey] = (state.requests.byStatus[statusKey] || 0) + 1;

  const methodKey = method || 'UNKNOWN';
  state.requests.byMethod[methodKey] = (state.requests.byMethod[methodKey] || 0) + 1;

  prometheus.recordRequest(method, path, statusCode, durationMs, route);
}

function incrementPaymentFailures() {
  state.paymentFailures += 1;
  prometheus.incrementPaymentFailures();
}

function incrementWebhookFailures(reason) {
  state.webhookFailures += 1;
  prometheus.incrementWebhookFailures(reason);
}

function incrementErrors() {
  state.errors += 1;
  prometheus.incrementErrors();
}

function incrementCheckoutStarted() {
  state.checkoutStarted += 1;
  prometheus.incrementCheckoutStarted();
}

function incrementCheckoutCompleted() {
  state.checkoutCompleted += 1;
  prometheus.incrementCheckoutCompleted();
}

function incrementCheckoutAbandoned(count = 1) {
  state.checkoutAbandoned += count;
  for (let i = 0; i < count; i += 1) {
    prometheus.incrementCheckoutAbandoned();
  }
}

function incrementReservationConflict(reason) {
  prometheus.incrementReservationConflict(reason);
}

function incrementAdminLoginFailures() {
  prometheus.incrementAdminLoginFailures();
}

function incrementEmailConfirmationFailures() {
  prometheus.incrementEmailConfirmationFailures();
}

function incrementBusinessEvent(event) {
  prometheus.incrementBusinessEvent(event);
}

function recordDbQuery(operation, durationMs) {
  prometheus.recordDbQuery(operation, durationMs);
}

function setGaugeValues(values) {
  prometheus.setGaugeValues(values);
}

function getSnapshot() {
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
  getSnapshot,
  getPrometheusMetrics: prometheus.getMetrics,
};
