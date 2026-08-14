const logger = require('../utils/logger');
const metrics = require('./metrics');

const DEFAULT_INTERVAL_MS = 30_000;

async function collectGaugeValues(pool) {
  const [
    paidNotConfirmedResult,
    processingPaidResult,
    activeReservationsResult,
    unresolvedFailuresResult,
  ] = await Promise.all([
    pool.query(
      "SELECT COUNT(*)::int AS count FROM reservations WHERE status IN ('manual_review', 'paid')"
    ),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM reservations WHERE status = 'processing_payment' AND stripe_session_id IS NOT NULL"
    ),
    pool.query(
      "SELECT COUNT(*)::int AS count FROM reservations WHERE status IN ('pending_payment', 'processing_payment')"
    ),
    pool.query(
      'SELECT COUNT(*)::int AS count FROM payment_failures WHERE resolved = false'
    ),
  ]);

  metrics.setGaugeValues({
    paidNotConfirmed: paidNotConfirmedResult.rows[0]?.count ?? 0,
    processingPaid: processingPaidResult.rows[0]?.count ?? 0,
    activeReservations: activeReservationsResult.rows[0]?.count ?? 0,
    unresolvedPaymentFailures: unresolvedFailuresResult.rows[0]?.count ?? 0,
    dbPoolTotal: pool.totalCount,
    dbPoolIdle: pool.idleCount,
    dbPoolWaiting: pool.waitingCount,
  });
}

function startGaugePoller(pool, intervalMs = DEFAULT_INTERVAL_MS) {
  const poll = async () => {
    try {
      await collectGaugeValues(pool);
    } catch (err) {
      logger.error({ err }, 'Gauge poller failed');
    }
  };

  void poll();
  return setInterval(poll, intervalMs);
}

module.exports = {
  startGaugePoller,
  collectGaugeValues,
};
