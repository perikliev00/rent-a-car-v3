/**
 * Liveness/readiness payloads for health endpoints (uptime, DB, Stripe, migrations).
 */
const { version } = require('../../package.json');
// Destructure object properties into local variables.
const { config } = require('../config/env');
// Destructure object properties into local variables.
const { getMigrationStatus } = require('../db/migrationStatus');
// Require the '../monitoring/metrics' module as metrics.
const metrics = require('../monitoring/metrics');

/** Process is up (no dependency checks). */
function getLiveStatus() {
  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: 'ok',
    // Provide the uptime seconds field value.
    uptimeSeconds: metrics.getUptimeSeconds(),
    // Contribute this line to the enclosing declaration or statement.
    version,
    // Provide the timestamp field value.
    timestamp: new Date().toISOString(),
  };
}

/**
 * Load stripe config status.
 * @returns {*}
 */
function getStripeConfigStatus() {
  // Create the has secret constant.
  const hasSecret = Boolean(config.stripeSecret);
  // Create the has webhook secret constant.
  const hasWebhookSecret = Boolean(config.stripeWebhookSecret);

  // Return the resulting value to the caller.
  return {
    // Provide the ok field value.
    ok: hasSecret && hasWebhookSecret,
    // Provide the configured field value.
    configured: hasSecret && hasWebhookSecret,
    // Provide the secret present field value.
    secretPresent: hasSecret,
    // Provide the webhook secret present field value.
    webhookSecretPresent: hasWebhookSecret,
  };
}

/**
 * Readiness: DB ping, Stripe secrets present, migrations applied.
 * @param {import('pg').Pool} pool
 * @returns {Promise<{ status: string, checks: object, timestamp: string }>}
 */
async function getReadyStatus(pool) {
  // Create the checks constant.
  const checks = {
    // Provide the database field value.
    database: { ok: false },
    // Provide the redis field value.
    redis: { ok: true, status: 'not_configured' },
    // Provide the stripe field value.
    stripe: getStripeConfigStatus(),
    // Provide the migrations field value.
    migrations: { ok: false, pending: [] },
  };

  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await pool.query('SELECT 1');
    // Update checks.database with the right-hand side value.
    checks.database = {
      // Provide the ok field value.
      ok: true,
      // Provide the pool field value.
      pool: {
        // Provide the total field value.
        total: pool.totalCount,
        // Provide the idle field value.
        idle: pool.idleCount,
        // Provide the waiting field value.
        waiting: pool.waitingCount,
      },
    };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Update checks.database with the right-hand side value.
    checks.database = {
      // Provide the ok field value.
      ok: false,
      // Provide the error field value.
      error: err.message,
    };
  }

  // Protected block: isolate failure modes.
  try {
    // Create the migration status constant.
    const migrationStatus = await getMigrationStatus(pool);
    // Update checks.migrations with the right-hand side value.
    checks.migrations = {
      // Provide the ok field value.
      ok: migrationStatus.ok,
      // Provide the pending field value.
      pending: migrationStatus.pending,
      // Provide the applied count field value.
      appliedCount: migrationStatus.applied.length,
      // Provide the expected count field value.
      expectedCount: migrationStatus.expected.length,
      // Provide the error field value.
      error: migrationStatus.error,
    };
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Update checks.migrations with the right-hand side value.
    checks.migrations = {
      // Provide the ok field value.
      ok: false,
      // Provide the pending field value.
      pending: [],
      // Provide the error field value.
      error: err.message,
    };
  }

  // Create the ready constant.
  const ready =
    // Contribute this line to the enclosing declaration or statement.
    checks.database.ok && checks.stripe.ok && checks.migrations.ok;

  // Return the resulting value to the caller.
  return {
    // Provide the status field value.
    status: ready ? 'ready' : 'not_ready',
    // Contribute this line to the enclosing declaration or statement.
    checks,
    // Provide the timestamp field value.
    timestamp: new Date().toISOString(),
  };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  getLiveStatus,
  // Contribute this line to the enclosing declaration or statement.
  getReadyStatus,
};
