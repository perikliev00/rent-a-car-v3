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
  // Evaluate the condition and enter the branch when it is true.
  if (value === undefined || value === null || String(value).trim() === '') {
    // Return the resulting value to the caller.
    return fallback;
  }
  // Create the parsed constant.
  const parsed = Number.parseInt(String(value), 10);
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isFinite(parsed) || parsed < 0) {
    // Return the resulting value to the caller.
    return fallback;
  }
  // Return the resulting value to the caller.
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
  // Create the is test constant.
  const isTest = env.NODE_ENV === 'test';
  // Create the is prod constant.
  const isProd = env.NODE_ENV === 'production';

  // Evaluate the condition and enter the branch when it is true.
  if (isTest) {
    // Return the resulting value to the caller.
    return {
      // Provide the max field value.
      max: parsePositiveInt(env.PG_POOL_MAX, 5),
      // Provide the idle timeout millis field value.
      idleTimeoutMillis: parsePositiveInt(env.PG_IDLE_TIMEOUT_MS, 1000),
      // Provide the connection timeout millis field value.
      connectionTimeoutMillis: parsePositiveInt(env.PG_CONNECTION_TIMEOUT_MS, 5000),
      // Provide the allow exit on idle field value.
      allowExitOnIdle: true,
      // Provide the statement timeout ms field value.
      statementTimeoutMs: parsePositiveInt(env.PG_STATEMENT_TIMEOUT_MS, 0),
      // Provide the idle in transaction timeout ms field value.
      idleInTransactionTimeoutMs: parsePositiveInt(env.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS, 0),
      // Provide the lock timeout ms field value.
      lockTimeoutMs: parsePositiveInt(env.PG_LOCK_TIMEOUT_MS, 0),
    };
  }

  // Return the resulting value to the caller.
  return {
    // Provide the max field value.
    max: parsePositiveInt(env.PG_POOL_MAX, isProd ? 20 : 10),
    // Provide the idle timeout millis field value.
    idleTimeoutMillis: parsePositiveInt(env.PG_IDLE_TIMEOUT_MS, 30000),
    // Provide the connection timeout millis field value.
    connectionTimeoutMillis: parsePositiveInt(env.PG_CONNECTION_TIMEOUT_MS, 5000),
    // Production defaults harden runaway queries; local stays unlimited unless set.
    statementTimeoutMs: parsePositiveInt(env.PG_STATEMENT_TIMEOUT_MS, isProd ? 15000 : 0),
    // Provide the idle in transaction timeout ms field value.
    idleInTransactionTimeoutMs: parsePositiveInt(
      // Contribute this line to the enclosing declaration or statement.
      env.PG_IDLE_IN_TRANSACTION_TIMEOUT_MS,
      // Contribute this line to the enclosing declaration or statement.
      isProd ? 30000 : 0
    ),
    // Provide the lock timeout ms field value.
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
  // Create the statements constant.
  const statements = [];
  // Evaluate the condition and enter the branch when it is true.
  if (timeouts.statementTimeoutMs > 0) {
    // Call statements.push to perform this step.
    statements.push(`SET statement_timeout = ${timeouts.statementTimeoutMs}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (timeouts.idleInTransactionTimeoutMs > 0) {
    // Call statements.push to perform this step.
    statements.push(
      // Continue the surrounding logic with this statement.
      `SET idle_in_transaction_session_timeout = ${timeouts.idleInTransactionTimeoutMs}`
    );
  }
  // Evaluate the condition and enter the branch when it is true.
  if (timeouts.lockTimeoutMs > 0) {
    // Call statements.push to perform this step.
    statements.push(`SET lock_timeout = ${timeouts.lockTimeoutMs}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (statements.length === 0) {
    // Return the resulting value to the caller.
    return Promise.resolve();
  }
  // Return the resulting value to the caller.
  return client.query(statements.join('; '));
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  parsePositiveInt,
  // Contribute this line to the enclosing declaration or statement.
  resolvePoolOptions,
  // Contribute this line to the enclosing declaration or statement.
  applySessionTimeouts,
};
