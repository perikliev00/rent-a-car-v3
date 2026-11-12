/**
 * Dedicated worker process: runs background jobs and exposes health/metrics only
 * (no public API routes). Used when API replicas disable in-process jobs via
 * `RUN_BACKGROUND_JOBS=false`.
 *
 * Side effects at load: validates env, initializes Sentry, starts bootstrap IIFE
 * that connects to Postgres, starts jobs, and listens for health probes.
 */
require('dotenv').config();

// Require the './config/env' module as env.
const env = require('./config/env');
// Same validation surface as the API process so worker env cannot drift.
env.validateEnv();
// Destructure object properties into local variables.
const { config } = env;

// Destructure object properties into local variables.
const { initSentry } = require('./config/sentry');
// Call initSentry to perform this step.
initSentry();

// Require the 'express' module as express.
const express = require('express');
// Require the './db/pool' module as pool.
const pool = require('./db/pool');
// Require the './utils/logger' module as logger.
const logger = require('./utils/logger');
// Require the './monitoring/metrics' module as metrics.
const metrics = require('./monitoring/metrics');
// Require the './middleware/requireMetricsToken' module as requireMetricsToken.
const requireMetricsToken = require('./middleware/requireMetricsToken');
// Destructure object properties into local variables.
const { getLiveStatus, getReadyStatus } = require('./services/healthService');
// Destructure object properties into local variables.
const { startGaugePoller } = require('./monitoring/gaugePoller');
// Destructure object properties into local variables.
const { startWorkerHeartbeat } = require('./monitoring/workerHeartbeat');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  startBackgroundJobs,
  // Contribute this line to the enclosing declaration or statement.
  stopBackgroundJobs,
// Continue the surrounding logic with this statement.
} = require('./jobs/backgroundJobRunner');

// Create the app constant.
const app = express();
// Initialize the mutable server variable.
let server = null;
// Initialize the mutable is shutting down variable.
let isShuttingDown = false;
// Initialize the mutable gauge poller timer variable.
let gaugePollerTimer = null;
// Initialize the mutable heartbeat timer variable.
let heartbeatTimer = null;

// Liveness for orchestration: process is up.
app.get('/health/live', (_req, res) => {
  // Call res.json to perform this step.
  res.json(getLiveStatus());
});

// Readiness: DB must respond; 503 when dependencies are down.
app.get('/health/ready', async (_req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the payload constant.
    const payload = await getReadyStatus(pool);
    // Call res.status to perform this step.
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call next to perform this step.
    next(err);
  }
});

// Alias of /health/live.
app.get('/health', (_req, res) => {
  // Call res.json to perform this step.
  res.json(getLiveStatus());
});

// Alias of /health/ready.
app.get('/ready', async (_req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the payload constant.
    const payload = await getReadyStatus(pool);
    // Call res.status to perform this step.
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call next to perform this step.
    next(err);
  }
});

// JSON metrics; token-gated like the API process.
app.get('/metrics', requireMetricsToken, (_req, res) => {
  // Call res.json to perform this step.
  res.json(metrics.getSnapshot());
});

// Prometheus exposition for the worker replica.
app.get('/prometheus', requireMetricsToken, async (_req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Call res.set to perform this step.
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    // Call res.send to perform this step.
    res.send(await metrics.getPrometheusMetrics());
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call next to perform this step.
    next(err);
  }
});

/**
 * Stop jobs, close the health HTTP server and DB pool, then exit.
 * Idempotent across concurrent signals.
 * Side effects: clears timers, stops jobs, closes HTTP server and pool, `process.exit`.
 * @param {string} trigger - Signal or error name that initiated shutdown
 * @param {Error|null} [error=null] - When set, process exits with code 1
 * @returns {Promise<void>}
 */
async function gracefulShutdown(trigger, error = null) {
  // Evaluate the condition and enter the branch when it is true.
  if (isShuttingDown) {
    // Return control to the caller with the following value.
    return;
  }

  // Update isShuttingDown with the right-hand side value.
  isShuttingDown = true;
  // Call logger.error to perform this step.
  logger.error({ trigger, err: error }, 'Starting worker graceful shutdown');

  // Call stopBackgroundJobs to perform this step.
  stopBackgroundJobs();
  // Evaluate the condition and enter the branch when it is true.
  if (gaugePollerTimer) {
    // Call clearInterval to perform this step.
    clearInterval(gaugePollerTimer);
    // Update gaugePollerTimer with the right-hand side value.
    gaugePollerTimer = null;
  }
  // Heartbeat is worker-only (API process does not emit it).
  if (heartbeatTimer) {
    // Call clearInterval to perform this step.
    clearInterval(heartbeatTimer);
    // Update heartbeatTimer with the right-hand side value.
    heartbeatTimer = null;
  }

  // Create the force exit timer constant.
  const forceExitTimer = setTimeout(() => {
    // Call logger.error to perform this step.
    logger.error('Worker graceful shutdown timed out. Forcing exit.');
    // Call process.exit to perform this step.
    process.exit(error ? 1 : 0);
  // Continue the surrounding logic with this statement.
  }, 10000);
  // Continue the surrounding logic with this statement.
  forceExitTimer.unref?.();

  // Start a try block for operations that may fail.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (server) {
      // Wait until the asynchronous operation resolves.
      await new Promise((resolve, reject) => {
        // Call server.close to perform this step.
        server.close((serverCloseError) => {
          // Evaluate the condition and enter the branch when it is true.
          if (serverCloseError) {
            // Call reject to perform this step.
            reject(serverCloseError);
            // Return control to the caller with the following value.
            return;
          }
          // Call resolve to perform this step.
          resolve();
        });
      });
    }

    // Wait until the asynchronous operation resolves.
    await pool.end();
  // Continue the surrounding logic with this statement.
  } catch (shutdownError) {
    // Call logger.error to perform this step.
    logger.error({ err: shutdownError }, 'Error during worker graceful shutdown');
  // Contribute this line to the enclosing declaration or statement.
  } finally {
    // Call clearTimeout to perform this step.
    clearTimeout(forceExitTimer);
    // Call process.exit to perform this step.
    process.exit(error ? 1 : 0);
  }
}

// Continue the surrounding logic with this statement.
(async () => {
  // Start a try block for operations that may fail.
  try {
    // Create the pg result constant.
    const pgResult = await pool.query('SELECT NOW() AS now');
    // Call logger.info to perform this step.
    logger.info({ dbTime: pgResult.rows[0].now }, 'PostgreSQL connected (worker)');

    // This process always runs jobs; API replicas may have them disabled.
    await startBackgroundJobs({ pool });
    // Update gaugePollerTimer with the right-hand side value.
    gaugePollerTimer = startGaugePoller(pool);
    // Lets monitoring confirm the dedicated worker is alive.
    heartbeatTimer = startWorkerHeartbeat();

    // Update server with the right-hand side value.
    server = app.listen(config.port, () => {
      // Call logger.info to perform this step.
      logger.info(
        // Contribute this line to the enclosing declaration or statement.
        { port: config.port, nodeEnv: config.nodeEnv, isProd: config.isProd },
        // Continue the surrounding logic with this statement.
        `LuxRide worker listening for health checks at http://localhost:${config.port}`
      );
    });

    // Call process.on to perform this step.
    process.on('SIGINT', () => {
      // Call gracefulShutdown to perform this step.
      gracefulShutdown('SIGINT');
    });

    // Call process.on to perform this step.
    process.on('SIGTERM', () => {
      // Call gracefulShutdown to perform this step.
      gracefulShutdown('SIGTERM');
    });

    // Call process.on to perform this step.
    process.on('unhandledRejection', (reason) => {
      // Create the err constant.
      const err = reason instanceof Error ? reason : new Error(String(reason));
      // Call logger.error to perform this step.
      logger.error({ err }, 'Unhandled promise rejection (worker)');
      // Call gracefulShutdown to perform this step.
      gracefulShutdown('unhandledRejection', err);
    });

    // Call process.on to perform this step.
    process.on('uncaughtException', (error) => {
      // Call logger.error to perform this step.
      logger.error({ err: error }, 'Uncaught exception (worker)');
      // Call gracefulShutdown to perform this step.
      gracefulShutdown('uncaughtException', error);
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err }, 'Worker bootstrap error');
    // Call process.exit to perform this step.
    process.exit(1);
  }
// Continue the surrounding logic with this statement.
})();
