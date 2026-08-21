const paymentEventSql = require('../sql/paymentEventSqlService');
const paymentFailureSql = require('../sql/paymentFailureSqlService');
const {
  finalizeReservationByStripeSessionId,
} = require('../bookingFinalizationService');
const {
  reconcileStripeSessions,
} = require('../payment/reconcileStripeSessionsService');
const path = require('path');

const RECONCILE_SCRIPT_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'reconcileStripeSessions.js'
);

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

async function reconcileStripeSession(stripeSessionId, metadata = {}) {
  return finalizeReservationByStripeSessionId(stripeSessionId, {
    ...metadata,
    logPrefix: '[AdminReconcile]',
  });
}

module.exports = {
  getPaymentMonitoringData,
  runPaymentReconciliation,
  reconcileStripeSession,
  RECONCILE_SCRIPT_PATH,
};
