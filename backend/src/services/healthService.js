const { version } = require('../../package.json');
const { config } = require('../config/env');
const { getMigrationStatus } = require('../db/migrationStatus');
const metrics = require('../monitoring/metrics');

function getLiveStatus() {
  return {
    status: 'ok',
    uptimeSeconds: metrics.getUptimeSeconds(),
    version,
    timestamp: new Date().toISOString(),
  };
}

function getStripeConfigStatus() {
  const hasSecret = Boolean(config.stripeSecret);
  const hasWebhookSecret = Boolean(config.stripeWebhookSecret);

  return {
    ok: hasSecret && hasWebhookSecret,
    configured: hasSecret && hasWebhookSecret,
    secretPresent: hasSecret,
    webhookSecretPresent: hasWebhookSecret,
  };
}

async function getReadyStatus(pool) {
  const checks = {
    database: { ok: false },
    redis: { ok: true, status: 'not_configured' },
    stripe: getStripeConfigStatus(),
    migrations: { ok: false, pending: [] },
  };

  try {
    await pool.query('SELECT 1');
    checks.database = {
      ok: true,
      pool: {
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount,
      },
    };
  } catch (err) {
    checks.database = {
      ok: false,
      error: err.message,
    };
  }

  try {
    const migrationStatus = await getMigrationStatus(pool);
    checks.migrations = {
      ok: migrationStatus.ok,
      pending: migrationStatus.pending,
      appliedCount: migrationStatus.applied.length,
      expectedCount: migrationStatus.expected.length,
      error: migrationStatus.error,
    };
  } catch (err) {
    checks.migrations = {
      ok: false,
      pending: [],
      error: err.message,
    };
  }

  const ready =
    checks.database.ok && checks.stripe.ok && checks.migrations.ok;

  return {
    status: ready ? 'ready' : 'not_ready',
    checks,
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  getLiveStatus,
  getReadyStatus,
};
