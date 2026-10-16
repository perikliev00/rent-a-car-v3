/**
 * Admin payment ops: refund queue, failure monitoring, and Stripe session
 * reconciliation. Pickup date filters use Europe/Sofia calendar days.
 */
const paymentEventSql = require('../sql/paymentEventSqlService');
const paymentFailureSql = require('../sql/paymentFailureSqlService');
const {
  finalizeReservationByStripeSessionId,
} = require('../bookingFinalizationService');
const {
  reconcileStripeSessions,
} = require('../payment/reconcileStripeSessionsService');
const { REFUNDABLE_STATUSES } = require('../payment/refund/refundPolicy');
const { BASE_SELECT, BASE_FROM, querySection } = require('./reservationOpsRowSql');
const path = require('path');

/** Path to the CLI reconcile script (exposed for admin tooling). */
const RECONCILE_SCRIPT_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'reconcileStripeSessions.js'
);

const DEFAULT_QUEUE_LIMIT = 50;
const REFUND_STATES = new Set(['none', 'pending', 'failed']);

/** Clamp queue page size to 1–50 to avoid oversized admin queries. */
function clampQueueLimit(limit) {
  const n = Number(limit);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isFinite(n)) return DEFAULT_QUEUE_LIMIT;
  return Math.min(50, Math.max(1, n));
}

/**
 * Optional exact-id search against reservation or order id.
 * @param {string[]} conditions
 * @param {unknown[]} params
 * @param {string} [q]
 */
function appendIdSearch(conditions, params, q) {
  const search = String(q || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!search) return;
  params.push(search);
  conditions.push(`(r.id::text = $${params.length} OR o.id::text = $${params.length})`);
}

/**
 * Bookings eligible for refund that do not already have a succeeded refund op.
 * @param {object} filters
 * @param {number} limit
 */
async function queryRefundableBookings(filters, limit) {
  const conditions = [
    `r.status IN (${REFUNDABLE_STATUSES.map((_, i) => `$${i + 1}`).join(', ')})`,
    `(refund_op.status IS NULL OR refund_op.status <> 'succeeded')`,
  ];
  const params = [...REFUNDABLE_STATUSES];

  const status = String(filters.status || '').trim();
  // Status / lifecycle guard before mutating domain state.
  if (status && REFUNDABLE_STATUSES.includes(status)) {
    params.push(status);
    conditions.push(`r.status = $${params.length}`);
  }

  const refundState = String(filters.refundState || '').trim();
  if (refundState && REFUND_STATES.has(refundState)) {
    if (refundState === 'none') {
      conditions.push('refund_op.id IS NULL');
    } else {
      params.push(refundState);
      conditions.push(`refund_op.status = $${params.length}`);
    }
  }

  // Sofia local date so overnight UTC shifts do not move bookings across days.
  const pickupFrom = String(filters.pickupFrom || '').trim();
  if (pickupFrom) {
    params.push(pickupFrom);
    conditions.push(`(r.pickup_date AT TIME ZONE 'Europe/Sofia')::date >= $${params.length}::date`);
  }

  const pickupTo = String(filters.pickupTo || '').trim();
  if (pickupTo) {
    params.push(pickupTo);
    conditions.push(`(r.pickup_date AT TIME ZONE 'Europe/Sofia')::date <= $${params.length}::date`);
  }

  appendIdSearch(conditions, params, filters.q);

  params.push(limit);
  return querySection(
    `
    SELECT ${BASE_SELECT}
    ${BASE_FROM}
    WHERE ${conditions.join('\n      AND ')}
    ORDER BY r.updated_at DESC
    LIMIT $${params.length}
    `,
    params
  );
}

/** Recently succeeded refunds for the ops sidebar. */
async function queryRecentRefunds({ q, limit }) {
  const conditions = [`refund_op.status = 'succeeded'`];
  const params = [];
  appendIdSearch(conditions, params, q);
  params.push(limit);
  return querySection(
    `
    SELECT ${BASE_SELECT}
    ${BASE_FROM}
    WHERE ${conditions.join('\n      AND ')}
    ORDER BY refund_op.updated_at DESC NULLS LAST, r.updated_at DESC
    LIMIT $${params.length}
    `,
    params
  );
}

/**
 * Combined refund queue: candidates + recent successes.
 * @param {object} [filters]
 */
async function listPaymentRefundQueue(filters = {}) {
  const limit = clampQueueLimit(filters.limit);
  const [refundable, recentRefunds] = await Promise.all([
    queryRefundableBookings(filters, limit),
    queryRecentRefunds({ q: filters.q, limit }),
  ]);
  return { refundable, recentRefunds, limit };
}

/** Recent payment events plus unresolved failure counts for monitoring. */
async function getPaymentMonitoringData() {
  const [events, failures, unresolvedCount] = await Promise.all([
    paymentEventSql.listRecentPaymentEvents({ limit: 50 }),
    paymentFailureSql.listPaymentFailures({ limit: 50, unresolvedOnly: true }),
    paymentFailureSql.countUnresolvedPaymentFailures(),
  ]);

  return {
    events,
    failures,
    unresolvedFailureCount: unresolvedCount,
  };
}

/**
 * Run Stripe session + pending-refund reconciliation from the admin UI.
 * stdout/stderr shape matches the CLI script contract for shared clients.
 * @param {{dryRun?: boolean, limit?: number}} [opts]
 */
async function runPaymentReconciliation({ dryRun = false, limit = 50 } = {}) {
  const { reconcilePendingRefunds } = require('../payment/refund/reservationRefundService');
  const sessionsResult = await reconcileStripeSessions({ dryRun, limit });
  const refundsResult = await reconcilePendingRefunds({
    dryRun,
    olderThanMinutes: 0,
    limit,
  });
  const result = {
    sessions: sessionsResult,
    refunds: refundsResult,
  };
  return {
    stdout: JSON.stringify(result),
    stderr: '',
    result,
  };
}

/**
 * Manually finalize a reservation from a Stripe Checkout session id.
 * @param {string} stripeSessionId
 * @param {object} [metadata]
 */
async function reconcileStripeSession(stripeSessionId, metadata = {}) {
  return finalizeReservationByStripeSessionId(stripeSessionId, {
    ...metadata,
    logPrefix: '[AdminReconcile]',
  });
}

module.exports = {
  getPaymentMonitoringData,
  listPaymentRefundQueue,
  runPaymentReconciliation,
  reconcileStripeSession,
  RECONCILE_SCRIPT_PATH,
};
