/**
 * pg Pool wrapper that records query latency metrics for Prometheus / in-process stats.
 */

const { Pool } = require('pg');
const metrics = require('../monitoring/metrics');

/**
 * Wrap `query` to measure duration and record the SQL verb (SELECT/INSERT/…).
 *
 * @param {Function} originalQuery
 * @param {object} context - `this` for the bound query (pool or client)
 * @returns {Function}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function wrapQuery(originalQuery, context) {
  return function instrumentedQuery(text, params, callback) {
    const start = process.hrtime.bigint();

    const finish = () => {
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      const operation =
        typeof text === 'string'
          ? text.trim().split(/\s+/)[0]?.toLowerCase() || 'query'
          : 'query';
      metrics.recordDbQuery(operation, durationMs);
    };

    if (typeof params === 'function') {
      callback = params;
      params = undefined;
    }

    if (typeof callback === 'function') {
      return originalQuery.call(context, text, params, (err, result) => {
        finish();
        callback(err, result);
      });
    }

    const result = originalQuery.call(context, text, params);
    if (result && typeof result.then === 'function') {
      return result
        .then((value) => {
          finish();
          return value;
        })
        .catch((err) => {
          finish();
          throw err;
        });
    }

    finish();
    return result;
  };
}

/**
 * @param {import('pg').PoolClient} client
 * @returns {import('pg').PoolClient}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function wrapClientQuery(client) {
  const clientQuery = client.query.bind(client);
  client.query = wrapQuery(clientQuery, client);
  return client;
}

/**
 * Create a Pool whose `query` and `connect` paths emit DB duration metrics.
 *
 * @param {import('pg').PoolConfig} options
 * @returns {import('pg').Pool}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function createInstrumentedPool(options) {
  const pool = new Pool(options);
  const originalQuery = pool.query.bind(pool);

  pool.query = wrapQuery(originalQuery, pool);

  const originalConnect = pool.connect.bind(pool);
  pool.connect = function instrumentedConnect(callback) {
    if (typeof callback === 'function') {
      return originalConnect((err, client, release) => {
        if (err) {
          callback(err);
          return;
        }
        callback(null, wrapClientQuery(client), release);
      });
    }

    return originalConnect().then((client) => wrapClientQuery(client));
  };

  return pool;
}

module.exports = {
  createInstrumentedPool,
};
