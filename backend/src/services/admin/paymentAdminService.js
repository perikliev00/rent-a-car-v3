/**
 * Admin payment ops: refund queue, failure monitoring, and Stripe session
 * reconciliation. Pickup date filters use Europe/Sofia calendar days.
 */
const paymentEventSql = require('../sql/paymentEventSqlService');
// Require the '../sql/paymentFailureSqlService' module as paymentFailureSql.
const paymentFailureSql = require('../sql/paymentFailureSqlService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  finalizeReservationByStripeSessionId,
// Continue the surrounding logic with this statement.
} = require('../bookingFinalizationService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  reconcileStripeSessions,
// Continue the surrounding logic with this statement.
} = require('../payment/reconcileStripeSessionsService');
// Destructure object properties into local variables.
const { REFUNDABLE_STATUSES } = require('../payment/refund/refundPolicy');
// Destructure object properties into local variables.
const { BASE_SELECT, BASE_FROM, querySection } = require('./reservationOpsRowSql');
// Require the 'path' module as path.
const path = require('path');

/** Path to the CLI reconcile script (exposed for admin tooling). */
const RECONCILE_SCRIPT_PATH = path.join(
  // Contribute this line to the enclosing declaration or statement.
  __dirname,
  // Supply the literal value used by the enclosing expression.
  '..',
  // Supply the literal value used by the enclosing expression.
  '..',
  // Supply the literal value used by the enclosing expression.
  '..',
  // Supply the literal value used by the enclosing expression.
  'scripts',
  // Supply the literal value used by the enclosing expression.
  'reconcileStripeSessions.js'
);

// Create the default queue limit constant.
const DEFAULT_QUEUE_LIMIT = 50;
// Create the refund states constant.
const REFUND_STATES = new Set(['none', 'pending', 'failed']);

/** Clamp queue page size to 1–50 to avoid oversized admin queries. */
function clampQueueLimit(limit) {
  // Create the n constant.
  const n = Number(limit);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isFinite(n)) return DEFAULT_QUEUE_LIMIT;
  // Return the resulting value to the caller.
  return Math.min(50, Math.max(1, n));
}

/**
 * Optional exact-id search against reservation or order id.
 * @param {string[]} conditions
 * @param {unknown[]} params
 * @param {string} [q]
 */
function appendIdSearch(conditions, params, q) {
  // Create the search constant.
  const search = String(q || '').trim();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!search) return;
  // Call params.push to perform this step.
  params.push(search);
  // Call conditions.push to perform this step.
  conditions.push(`(r.id::text = $${params.length} OR o.id::text = $${params.length})`);
}

/**
 * Bookings eligible for refund that do not already have a succeeded refund op.
 * @param {object} filters
 * @param {number} limit
 */
async function queryRefundableBookings(filters, limit) {
  // Create the conditions constant.
  const conditions = [
    // Continue the surrounding logic with this statement.
    `r.status IN (${REFUNDABLE_STATUSES.map((_, i) => `$${i + 1}`).join(', ')})`,
    // Continue the surrounding logic with this statement.
    `(refund_op.status IS NULL OR refund_op.status <> 'succeeded')`,
  ];
  // Create the params constant.
  const params = [...REFUNDABLE_STATUSES];

  // Create the status constant.
  const status = String(filters.status || '').trim();
  // Status / lifecycle guard before mutating domain state.
  if (status && REFUNDABLE_STATUSES.includes(status)) {
    // Call params.push to perform this step.
    params.push(status);
    // Call conditions.push to perform this step.
    conditions.push(`r.status = $${params.length}`);
  }

  // Create the refund state constant.
  const refundState = String(filters.refundState || '').trim();
  // Evaluate the condition and enter the branch when it is true.
  if (refundState && REFUND_STATES.has(refundState)) {
    // Evaluate the condition and enter the branch when it is true.
    if (refundState === 'none') {
      // Call conditions.push to perform this step.
      conditions.push('refund_op.id IS NULL');
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // Call params.push to perform this step.
      params.push(refundState);
      // Call conditions.push to perform this step.
      conditions.push(`refund_op.status = $${params.length}`);
    }
  }

  // Sofia local date so overnight UTC shifts do not move bookings across days.
  const pickupFrom = String(filters.pickupFrom || '').trim();
  // Evaluate the condition and enter the branch when it is true.
  if (pickupFrom) {
    // Call params.push to perform this step.
    params.push(pickupFrom);
    // Call conditions.push to perform this step.
    conditions.push(`(r.pickup_date AT TIME ZONE 'Europe/Sofia')::date >= $${params.length}::date`);
  }

  // Create the pickup to constant.
  const pickupTo = String(filters.pickupTo || '').trim();
  // Evaluate the condition and enter the branch when it is true.
  if (pickupTo) {
    // Call params.push to perform this step.
    params.push(pickupTo);
    // Call conditions.push to perform this step.
    conditions.push(`(r.pickup_date AT TIME ZONE 'Europe/Sofia')::date <= $${params.length}::date`);
  }

  // Call appendIdSearch to perform this step.
  appendIdSearch(conditions, params, filters.q);

  // Call params.push to perform this step.
  params.push(limit);
  // Return the resulting value to the caller.
  return querySection(
    // Continue the surrounding logic with this statement.
    `
    SELECT ${BASE_SELECT}
    ${BASE_FROM}
    WHERE ${conditions.join('\n      AND ')}
    ORDER BY r.updated_at DESC
    LIMIT $${params.length}
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );
}

/** Recently succeeded refunds for the ops sidebar. */
async function queryRecentRefunds({ q, limit }) {
  // Create the conditions constant.
  const conditions = [`refund_op.status = 'succeeded'`];
  // Create the params constant.
  const params = [];
  // Call appendIdSearch to perform this step.
  appendIdSearch(conditions, params, q);
  // Call params.push to perform this step.
  params.push(limit);
  // Return the resulting value to the caller.
  return querySection(
    // Continue the surrounding logic with this statement.
    `
    SELECT ${BASE_SELECT}
    ${BASE_FROM}
    WHERE ${conditions.join('\n      AND ')}
    ORDER BY refund_op.updated_at DESC NULLS LAST, r.updated_at DESC
    LIMIT $${params.length}
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );
}

/**
 * Combined refund queue: candidates + recent successes.
 * @param {object} [filters]
 */
async function listPaymentRefundQueue(filters = {}) {
  // Create the limit constant.
  const limit = clampQueueLimit(filters.limit);
  // Destructure array values into local variables.
  const [refundable, recentRefunds] = await Promise.all([
    // Call queryRefundableBookings to perform this step.
    queryRefundableBookings(filters, limit),
    // Call queryRecentRefunds to perform this step.
    queryRecentRefunds({ q: filters.q, limit }),
  ]);
  // Return the resulting value to the caller.
  return { refundable, recentRefunds, limit };
}

/** Recent payment events plus unresolved failure counts for monitoring. */
async function getPaymentMonitoringData() {
  // Destructure array values into local variables.
  const [events, failures, unresolvedCount] = await Promise.all([
    // Call paymentEventSql.listRecentPaymentEvents to perform this step.
    paymentEventSql.listRecentPaymentEvents({ limit: 50 }),
    // Call paymentFailureSql.listPaymentFailures to perform this step.
    paymentFailureSql.listPaymentFailures({ limit: 50, unresolvedOnly: true }),
    // Call paymentFailureSql.countUnresolvedPaymentFailures to perform this step.
    paymentFailureSql.countUnresolvedPaymentFailures(),
  ]);

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    events,
    // Contribute this line to the enclosing declaration or statement.
    failures,
    // Provide the unresolved failure count field value.
    unresolvedFailureCount: unresolvedCount,
  };
}

/**
 * Run Stripe session + pending-refund reconciliation from the admin UI.
 * stdout/stderr shape matches the CLI script contract for shared clients.
 * @param {{dryRun?: boolean, limit?: number}} [opts]
 */
async function runPaymentReconciliation({ dryRun = false, limit = 50 } = {}) {
  // Destructure object properties into local variables.
  const { reconcilePendingRefunds } = require('../payment/refund/reservationRefundService');
  // Create the sessions result constant.
  const sessionsResult = await reconcileStripeSessions({ dryRun, limit });
  // Create the refunds result constant.
  const refundsResult = await reconcilePendingRefunds({
    // Contribute this line to the enclosing declaration or statement.
    dryRun,
    // Provide the older than minutes field value.
    olderThanMinutes: 0,
    // Contribute this line to the enclosing declaration or statement.
    limit,
  });
  // Create the result constant.
  const result = {
    // Provide the sessions field value.
    sessions: sessionsResult,
    // Provide the refunds field value.
    refunds: refundsResult,
  };
  // Return the resulting value to the caller.
  return {
    // Provide the stdout field value.
    stdout: JSON.stringify(result),
    // Provide the stderr field value.
    stderr: '',
    // Contribute this line to the enclosing declaration or statement.
    result,
  };
}

/**
 * Manually finalize a reservation from a Stripe Checkout session id.
 * @param {string} stripeSessionId
 * @param {object} [metadata]
 */
async function reconcileStripeSession(stripeSessionId, metadata = {}) {
  // Return the resulting value to the caller.
  return finalizeReservationByStripeSessionId(stripeSessionId, {
    // Spread metadata into the surrounding structure.
    ...metadata,
    // Provide the log prefix field value.
    logPrefix: '[AdminReconcile]',
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getPaymentMonitoringData,
  // Contribute this line to the enclosing declaration or statement.
  listPaymentRefundQueue,
  // Contribute this line to the enclosing declaration or statement.
  runPaymentReconciliation,
  // Contribute this line to the enclosing declaration or statement.
  reconcileStripeSession,
  // Contribute this line to the enclosing declaration or statement.
  RECONCILE_SCRIPT_PATH,
};
