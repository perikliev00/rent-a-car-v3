/**
 * Pool + session timeout defaults for node-postgres.
 * Formula: PG_POOL_MAX × (API replicas + worker) < managed max_connections − ~10 reserve.
 */

/**
 * Parse a non-negative integer from env, or return `fallback` when missing/invalid.
 *
 * @param {unknown} value
 * @param {number} fallback
 * @returns {number}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function parsePositiveInt(value, fallback) {
  if (value === undefined || value === null || String(value).trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Resolve pg Pool options and session timeout ms from environment.
 *
 * @param {NodeJS.ProcessEnv} [env=process.env]
 * @returns {object}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function resolvePoolOptions(env = process.env) {
  const isTest = env.NODE_ENV === 'test';
  const isProd = env.NODE_ENV === 'production';

  if (isTest) {
    return {
      max: parsePositiveInt(env.PG_POOL_MAX, 5),
      idleTimeoutMillis: parsePositiveInt(env.PG_IDLE_TIMEOUT_MS, 1000),
      connectionTimeoutMillis: parsePositiveInt(env.PG_CONNECTION_TIMEOUT_MS, 5000),
      allowExitOnIdle: true,
      statementTimeoutMs: parsePositiveInt(env.PG_STATEMENT_TIMEOUT_MS, 0),
      idleInTransactionTimeoutMs: parsePositiveInt(env.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS, 0),
      lockTimeoutMs: parsePositiveInt(env.PG_LOCK_TIMEOUT_MS, 0),
    };
  }

  return {
    max: parsePositiveInt(env.PG_POOL_MAX, isProd ? 20 : 10),
    idleTimeoutMillis: parsePositiveInt(env.PG_IDLE_TIMEOUT_MS, 30000),
    connectionTimeoutMillis: parsePositiveInt(env.PG_CONNECTION_TIMEOUT_MS, 5000),
    // Production defaults harden runaway queries; local stays unlimited unless set.
    statementTimeoutMs: parsePositiveInt(env.PG_STATEMENT_TIMEOUT_MS, isProd ? 15000 : 0),
    idleInTransactionTimeoutMs: parsePositiveInt(
      env.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS,
      isProd ? 30000 : 0
    ),
    lockTimeoutMs: parsePositiveInt(env.PG_LOCK_TIMEOUT_MS, isProd ? 5000 : 0),
  };
}

/**
 * Apply statement / idle-in-transaction / lock timeouts on a freshly checked-out client.
 *
 * @param {import('pg').PoolClient} client
 * @param {{ statementTimeoutMs: number, idleInTransactionTimeoutMs: number, lockTimeoutMs: number }} timeouts
 * @returns {Promise<unknown>}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function applySessionTimeouts(client, timeouts) {
  const statements = [];
  if (timeouts.statementTimeoutMs > 0) {
    statements.push(`SET statement_timeout = ${timeouts.statementTimeoutMs}`);
  }
  if (timeouts.idleInTransactionTimeoutMs > 0) {
    statements.push(
      `SET idle_in_transaction_session_timeout = ${timeouts.idleInTransactionTimeoutMs}`
    );
  }
  if (timeouts.lockTimeoutMs > 0) {
    statements.push(`SET lock_timeout = ${timeouts.lockTimeoutMs}`);
  }
  if (statements.length === 0) {
    return Promise.resolve();
  }
  return client.query(statements.join('; '));
}

module.exports = {
  parsePositiveInt,
  resolvePoolOptions,
  applySessionTimeouts,
};
