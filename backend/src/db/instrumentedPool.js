/**
 * pg Pool wrapper that records query latency metrics for Prometheus / in-process stats.
 */

const { Pool } = require('pg');
// Require the '../monitoring/metrics' module as metrics.
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
  // Return the resulting value to the caller.
  return function instrumentedQuery(text, params, callback) {
    // Create the start constant.
    const start = process.hrtime.bigint();

    // Create the finish constant.
    const finish = () => {
      // Create the duration ms constant.
      const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
      // Create the operation constant.
      const operation =
        // Continue the surrounding logic with this statement.
        typeof text === 'string'
          // Continue the surrounding logic with this statement.
          ? text.trim().split(/\s+/)[0]?.toLowerCase() || 'query'
          // Contribute this line to the enclosing declaration or statement.
          : 'query';
      // Call metrics.recordDbQuery to perform this step.
      metrics.recordDbQuery(operation, durationMs);
    };

    // Evaluate the condition and enter the branch when it is true.
    if (typeof params === 'function') {
      // Update callback with the right-hand side value.
      callback = params;
      // Update params with the right-hand side value.
      params = undefined;
    }

    // Evaluate the condition and enter the branch when it is true.
    if (typeof callback === 'function') {
      // Return the resulting value to the caller.
      return originalQuery.call(context, text, params, (err, result) => {
        // Call finish to perform this step.
        finish();
        // Call callback to perform this step.
        callback(err, result);
      });
    }

    // Create the result constant.
    const result = originalQuery.call(context, text, params);
    // Evaluate the condition and enter the branch when it is true.
    if (result && typeof result.then === 'function') {
      // Return the resulting value to the caller.
      return result
        // Call .then to perform this step.
        .then((value) => {
          // Call finish to perform this step.
          finish();
          // Return the resulting value to the caller.
          return value;
        })
        // Call .catch to perform this step.
        .catch((err) => {
          // Call finish to perform this step.
          finish();
          // Throw an error to stop the current control flow.
          throw err;
        });
    }

    // Call finish to perform this step.
    finish();
    // Return the resulting value to the caller.
    return result;
  };
}

/**
 * @param {import('pg').PoolClient} client
 * @returns {import('pg').PoolClient}
 * @throws {Error} Propagates unexpected failures from callees / I/O
 */
function wrapClientQuery(client) {
  // Create the client query constant.
  const clientQuery = client.query.bind(client);
  // Update client.query with the right-hand side value.
  client.query = wrapQuery(clientQuery, client);
  // Return the resulting value to the caller.
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
  // Create the pool constant.
  const pool = new Pool(options);
  // Create the original query constant.
  const originalQuery = pool.query.bind(pool);

  // Update pool.query with the right-hand side value.
  pool.query = wrapQuery(originalQuery, pool);

  // Create the original connect constant.
  const originalConnect = pool.connect.bind(pool);
  // Update pool.connect with the right-hand side value.
  pool.connect = function instrumentedConnect(callback) {
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
        // Call callback to perform this step.
        callback(null, wrapClientQuery(client), release);
      });
    }

    // Return the resulting value to the caller.
    return originalConnect().then((client) => wrapClientQuery(client));
  };

  // Return the resulting value to the caller.
  return pool;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createInstrumentedPool,
};
