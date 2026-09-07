const { createInstrumentedPool } = require('./instrumentedPool');
const { resolvePoolOptions, applySessionTimeouts } = require('./poolConfig');

function isUsablePool(pool) {
  return Boolean(pool) && pool.ended !== true && pool.ending !== true;
}

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
