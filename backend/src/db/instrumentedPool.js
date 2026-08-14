const { Pool } = require('pg');
const metrics = require('../monitoring/metrics');

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

function wrapClientQuery(client) {
  const clientQuery = client.query.bind(client);
  client.query = wrapQuery(clientQuery, client);
  return client;
}

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
