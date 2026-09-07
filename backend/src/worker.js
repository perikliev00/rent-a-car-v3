require('dotenv').config();

const env = require('./config/env');
env.validateEnv();
const { config } = env;

const { initSentry } = require('./config/sentry');
initSentry();

const express = require('express');
const pool = require('./db/pool');
const logger = require('./utils/logger');
const { getLiveStatus, getReadyStatus } = require('./services/healthService');
const {
  startBackgroundJobs,
  stopBackgroundJobs,
} = require('./jobs/backgroundJobRunner');

const app = express();
let server = null;
let isShuttingDown = false;

app.get('/health/live', (_req, res) => {
  res.json(getLiveStatus());
});

app.get('/health/ready', async (_req, res, next) => {
  try {
    const payload = await getReadyStatus(pool);
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  } catch (err) {
    next(err);
  }
});

app.get('/health', (_req, res) => {
  res.json(getLiveStatus());
});

app.get('/ready', async (_req, res, next) => {
  try {
    const payload = await getReadyStatus(pool);
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  } catch (err) {
    next(err);
  }
});

async function gracefulShutdown(trigger, error = null) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.error({ trigger, err: error }, 'Starting worker graceful shutdown');

  stopBackgroundJobs();

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

    await startBackgroundJobs({ pool });

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
