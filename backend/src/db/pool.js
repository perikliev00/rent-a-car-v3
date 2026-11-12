/**
 * Shared PostgreSQL pool singleton for the API process.
 * Test mode reuses `global.__luxridePgPool` so suites share one connection pool.
 */

const { createInstrumentedPool } = require('./instrumentedPool');
// Destructure object properties into local variables.
const { resolvePoolOptions, applySessionTimeouts } = require('./poolConfig');

/**
 * @param {import('pg').Pool | null | undefined} pool
 * @returns {boolean}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function isUsablePool(pool) {
  // Return the resulting value to the caller.
  return Boolean(pool) && pool.ended !== true && pool.ending !== true;
}

/**
 * Wrap `pool.connect` so each client gets session timeout GUCs applied before use.
 *
 * @param {import('pg').Pool} pool
 * @param {{ statementTimeoutMs: number, idleInTransactionTimeoutMs: number, lockTimeoutMs: number }} timeouts
 * @returns {import('pg').Pool}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function wrapConnectWithTimeouts(pool, timeouts) {
  // Create the original connect constant.
  const originalConnect = pool.connect.bind(pool);

  // Update pool.connect with the right-hand side value.
  pool.connect = function connectWithTimeouts(callback) {
    // Evaluate the condition and enter the branch when it is true.
    if (typeof callback === 'function') {
      // Return the resulting value to the caller.
      return originalConnect((err, client, release) => {
        // Evaluate the condition and enter the branch when it is true.
        if (err) {
          // Call callback to perform this step.
          callback(err);
          // Return control to the caller with the following value.
          return;
        }
        // Call applySessionTimeouts to perform this step.
        applySessionTimeouts(client, timeouts)
          // Call .then to perform this step.
          .then(() => callback(null, client, release))
          // Call .catch to perform this step.
          .catch((timeoutErr) => {
            // Call release to perform this step.
            release();
            // Call callback to perform this step.
            callback(timeoutErr);
          });
      });
    }

    // Return the resulting value to the caller.
    return originalConnect().then(async (client) => {
      // Start a try block for operations that may fail.
      try {
        // Wait until the asynchronous operation resolves.
        await applySessionTimeouts(client, timeouts);
        // Return the resulting value to the caller.
        return client;
      // Continue the surrounding logic with this statement.
      } catch (timeoutErr) {
        // Call client.release to perform this step.
        client.release();
        // Throw an error to stop the current control flow.
        throw timeoutErr;
      }
    });
  };

  // Return the resulting value to the caller.
  return pool;
}

/**
 * Create an instrumented pool with session timeout wrapping.
 *
 * @returns {import('pg').Pool}
 * @throws {Error} When pool construction / env resolution fails
 */
function createPool() {
  // Destructure object properties into local variables.
  const {
    // Contribute this line to the enclosing declaration or statement.
    statementTimeoutMs,
    // Contribute this line to the enclosing declaration or statement.
    idleInTransactionTimeoutMs,
    // Contribute this line to the enclosing declaration or statement.
    lockTimeoutMs,
    // Spread poolOptions into the surrounding structure.
    ...poolOptions
  // Continue the surrounding logic with this statement.
  } = resolvePoolOptions();

  // Create the pool constant.
  const pool = createInstrumentedPool({
    // Provide the connection string field value.
    connectionString: process.env.DATABASE_URL,
    // Spread poolOptions into the surrounding structure.
    ...poolOptions,
  });

  // Return the resulting value to the caller.
  return wrapConnectWithTimeouts(pool, {
    // Contribute this line to the enclosing declaration or statement.
    statementTimeoutMs,
    // Contribute this line to the enclosing declaration or statement.
    idleInTransactionTimeoutMs,
    // Contribute this line to the enclosing declaration or statement.
    lockTimeoutMs,
  });
}

/**
 * Lazy singleton accessor (test vs production caches).
 * @returns {import('pg').Pool}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function getPool() {
  // Evaluate the condition and enter the branch when it is true.
  if (process.env.NODE_ENV === 'test') {
    // Evaluate the condition and enter the branch when it is true.
    if (isUsablePool(global.__luxridePgPool)) {
      // Return the resulting value to the caller.
      return global.__luxridePgPool;
    }
    // Create the test pool constant.
    const testPool = createPool();
    // Update global.__luxridePgPool with the right-hand side value.
    global.__luxridePgPool = testPool;
    // Return the resulting value to the caller.
    return testPool;
  }

  // Evaluate the condition and enter the branch when it is true.
  if (!getPool._prod || !isUsablePool(getPool._prod)) {
    // Update getPool._prod with the right-hand side value.
    getPool._prod = createPool();
  }
  // Return the resulting value to the caller.
  return getPool._prod;
}

// Assign the CommonJS module exports.
module.exports = getPool();
