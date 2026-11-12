/**
 * Dedicated worker process: runs background jobs and exposes health/metrics only
 * (no public API routes). Used when API replicas disable in-process jobs via
 * `RUN_BACKGROUND_JOBS=false`.
 *
 * Side effects at load: validates env, initializes Sentry, starts bootstrap IIFE
 * that connects to Postgres, starts jobs, and listens for health probes.
 */
require('dotenv').config();

const env = require('./config/env');
// Same validation surface as the API process so worker env cannot drift.
env.validateEnv();
const { config } = env;

const { initSentry } = require('./config/sentry');
initSentry();

const express = require('express');
const pool = require('./db/pool');
const logger = require('./utils/logger');
const metrics = require('./monitoring/metrics');
const requireMetricsToken = require('./middleware/requireMetricsToken');
const { getLiveStatus, getReadyStatus } = require('./services/healthService');
const { startGaugePoller } = require('./monitoring/gaugePoller');
const { startWorkerHeartbeat } = require('./monitoring/workerHeartbeat');
const {
  startBackgroundJobs,
  stopBackgroundJobs,
} = require('./jobs/backgroundJobRunner');

const app = express();
let server = null;
let isShuttingDown = false;
let gaugePollerTimer = null;
let heartbeatTimer = null;

// Liveness for orchestration: process is up.
app.get('/health/live', (_req, res) => {
  res.json(getLiveStatus());
});

// Readiness: DB must respond; 503 when dependencies are down.
app.get('/health/ready', async (_req, res, next) => {
  try {
    const payload = await getReadyStatus(pool);
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  } catch (err) {
    next(err);
  }
});

// Alias of /health/live.
app.get('/health', (_req, res) => {
  res.json(getLiveStatus());
});

// Alias of /health/ready.
app.get('/ready', async (_req, res, next) => {
  try {
    const payload = await getReadyStatus(pool);
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  } catch (err) {
    next(err);
  }
});

// JSON metrics; token-gated like the API process.
app.get('/metrics', requireMetricsToken, (_req, res) => {
  res.json(metrics.getSnapshot());
});

// Prometheus exposition for the worker replica.
app.get('/prometheus', requireMetricsToken, async (_req, res, next) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(await metrics.getPrometheusMetrics());
  } catch (err) {
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
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.error({ trigger, err: error }, 'Starting worker graceful shutdown');

  stopBackgroundJobs();
  if (gaugePollerTimer) {
    clearInterval(gaugePollerTimer);
    gaugePollerTimer = null;
  }
  // Heartbeat is worker-only (API process does not emit it).
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }

  const forceExitTimer = setTimeout(() => {
    logger.error('Worker graceful shutdown timed out. Forcing exit.');
    process.exit(error ? 1 : 0);
  }, 10000);
  forceExitTimer.unref?.();

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((serverCloseError) => {
          if (serverCloseError) {
            reject(serverCloseError);
            return;
          }
          resolve();
        });
      });
    }

    await pool.end();
  } catch (shutdownError) {
    logger.error({ err: shutdownError }, 'Error during worker graceful shutdown');
  } finally {
    clearTimeout(forceExitTimer);
    process.exit(error ? 1 : 0);
  }
}

(async () => {
  try {
    const pgResult = await pool.query('SELECT NOW() AS now');
    logger.info({ dbTime: pgResult.rows[0].now }, 'PostgreSQL connected (worker)');

    // This process always runs jobs; API replicas may have them disabled.
    await startBackgroundJobs({ pool });
    gaugePollerTimer = startGaugePoller(pool);
    // Lets monitoring confirm the dedicated worker is alive.
    heartbeatTimer = startWorkerHeartbeat();

    server = app.listen(config.port, () => {
      logger.info(
        { port: config.port, nodeEnv: config.nodeEnv, isProd: config.isProd },
        `LuxRide worker listening for health checks at http://localhost:${config.port}`
      );
    });

    process.on('SIGINT', () => {
      gracefulShutdown('SIGINT');
    });

    process.on('SIGTERM', () => {
      gracefulShutdown('SIGTERM');
    });

    process.on('unhandledRejection', (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      logger.error({ err }, 'Unhandled promise rejection (worker)');
      gracefulShutdown('unhandledRejection', err);
    });

    process.on('uncaughtException', (error) => {
      logger.error({ err: error }, 'Uncaught exception (worker)');
      gracefulShutdown('uncaughtException', error);
    });
  } catch (err) {
    logger.error({ err }, 'Worker bootstrap error');
    process.exit(1);
  }
})();
