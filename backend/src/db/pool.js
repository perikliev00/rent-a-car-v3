/**
 * Shared PostgreSQL pool singleton for the API process.
 * Test mode reuses `global.__luxridePgPool` so suites share one connection pool.
 */

const { createInstrumentedPool } = require('./instrumentedPool');
const { resolvePoolOptions, applySessionTimeouts } = require('./poolConfig');

/**
 * @param {import('pg').Pool | null | undefined} pool
 * @returns {boolean}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function isUsablePool(pool) {
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
  const originalConnect = pool.connect.bind(pool);

  pool.connect = function connectWithTimeouts(callback) {
    if (typeof callback === 'function') {
      return originalConnect((err, client, release) => {
        if (err) {
          callback(err);
          return;
        }
        applySessionTimeouts(client, timeouts)
          .then(() => callback(null, client, release))
          .catch((timeoutErr) => {
            release();
            callback(timeoutErr);
          });
      });
    }

    return originalConnect().then(async (client) => {
      try {
        await applySessionTimeouts(client, timeouts);
        return client;
      } catch (timeoutErr) {
        client.release();
        throw timeoutErr;
      }
    });
  };

  return pool;
}

/**
 * Create an instrumented pool with session timeout wrapping.
 *
 * @returns {import('pg').Pool}
 * @throws {Error} When pool construction / env resolution fails
 */
function createPool() {
  const {
    statementTimeoutMs,
    idleInTransactionTimeoutMs,
    lockTimeoutMs,
    ...poolOptions
  } = resolvePoolOptions();

  const pool = createInstrumentedPool({
    connectionString: process.env.DATABASE_URL,
    ...poolOptions,
  });

  return wrapConnectWithTimeouts(pool, {
    statementTimeoutMs,
    idleInTransactionTimeoutMs,
    lockTimeoutMs,
  });
}

/**
 * Lazy singleton accessor (test vs production caches).
 * @returns {import('pg').Pool}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function getPool() {
  if (process.env.NODE_ENV === 'test') {
    if (isUsablePool(global.__luxridePgPool)) {
      return global.__luxridePgPool;
    }
    const testPool = createPool();
    global.__luxridePgPool = testPool;
    return testPool;
  }

  if (!getPool._prod || !isUsablePool(getPool._prod)) {
    getPool._prod = createPool();
  }
  return getPool._prod;
}

module.exports = getPool();
