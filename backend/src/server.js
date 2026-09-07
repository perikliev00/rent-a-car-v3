require('dotenv').config();

const env = require('./config/env');
env.validateEnv();
const { config } = env;

const { initSentry } = require('./config/sentry');
initSentry();

const express = require('express');
const path = require('path');
const pool = require('./db/pool');
const logger = require('./utils/logger');
const metrics = require('./monitoring/metrics');
const bodyParser = require('body-parser');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const paymentController = require('./controllers/payment');
const {
  adminLimiter,
  checkoutLimiter,
  bookingLimiter,
  chatLimiter,
  contactLimiter,
} = require('./middleware/rateLimit');
const { ensureCsrfToken, requireCsrfToken, getCsrfToken } = require('./middleware/csrf');
const { optionalApiKeyAuth } = require('./middleware/apiKeyAuth');
const applySecurity = require('./config/security');
const { requestIdMiddleware } = require('./middleware/requestIdMiddleware');
const requestMetrics = require('./middleware/requestMetrics');
const { getLiveStatus, getReadyStatus } = require('./services/healthService');
const { startGaugePoller } = require('./monitoring/gaugePoller');
const { createCorsMiddleware } = require('./config/cors');
const requireMetricsToken = require('./middleware/requireMetricsToken');
const { handleNotFound, errorHandler } = require('./middleware/errorHandler');
const { createShutdownGate } = require('./middleware/shutdownGate');
const apiRoutes = require('./routes/api');

const { ensureSessionTable } = require('./services/sql/sessionSqlService');
const { initRealtime, shutdownRealtime } = require('./modules/realtime');
const { isBackgroundJobsEnabled } = require('./config/backgroundJobs');
const {
  startBackgroundJobs,
  stopBackgroundJobs,
} = require('./jobs/backgroundJobRunner');

const app = express();
const SESSION_IDLE_MS = 20 * 60 * 1000;
const isProd = config.isProd;
let server = null;
let isShuttingDown = false;
let gaugePollerTimer = null;

app.use(requestIdMiddleware);
app.use(requestMetrics);
app.use(createShutdownGate(() => isShuttingDown));

const corsMiddleware = createCorsMiddleware(config);
if (corsMiddleware) {
  app.use(corsMiddleware);
}

app.use('/images', express.static(path.join(__dirname, 'public/images')));

app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.handleStripeWebhook
);

app.use(bodyParser.json());
applySecurity(app, { isProd });

app.get('/health/live', (req, res) => {
  res.json(getLiveStatus());
});

app.get('/health/ready', async (req, res, next) => {
  try {
    const payload = await getReadyStatus(pool);
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  } catch (err) {
    next(err);
  }
});

app.get('/health', (req, res) => {
  res.json(getLiveStatus());
});

app.get('/ready', async (req, res, next) => {
  try {
    const payload = await getReadyStatus(pool);
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  } catch (err) {
    next(err);
  }
});

app.get('/metrics', requireMetricsToken, (req, res) => {
  res.json(metrics.getSnapshot());
});

app.get('/prometheus', requireMetricsToken, async (req, res, next) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(await metrics.getPrometheusMetrics());
  } catch (err) {
    next(err);
  }
});

const store = new pgSession({
  pool,
  tableName: 'session',
  createTableIfMissing: true,
  ttl: Math.floor(SESSION_IDLE_MS / 1000),
  pruneSessionInterval: 15 * 60,
});

store.on('error', (err) => {
  logger.error({ err }, 'Session store error');
});

if (isProd) {
  app.set('trust proxy', 1);
}

app.use(
  session({
    name: 'sid',
    secret: config.sessionSecret,
    store,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: config.sessionCookieSameSite,
      secure: config.sessionCookieSecure,
      maxAge: SESSION_IDLE_MS,
    },
  })
);

app.use((req, _res, next) => {
  if (!req.session.isPaid) req.session.isPaid = false;
  if (req.session._sid !== req.sessionID) req.session._sid = req.sessionID;
  next();
});

app.use('/api', ensureCsrfToken);
app.use('/api', optionalApiKeyAuth);
app.use('/api', requireCsrfToken);

function mountVersionedApi(prefix) {
  app.use(`${prefix}/checkout`, checkoutLimiter);
  app.use(`${prefix}/orders`, bookingLimiter);
  app.use(`${prefix}/reservations`, bookingLimiter);
  app.use(`${prefix}/chat`, chatLimiter);
  app.use(`${prefix}/contacts`, contactLimiter);
  app.use(`${prefix}/admin`, adminLimiter);
  app.use(prefix, apiRoutes);
}

// Canonical versioned API + backward-compatible alias
mountVersionedApi('/api/v1');
mountVersionedApi('/api');
app.use(handleNotFound);
app.use(errorHandler);

async function gracefulShutdown(trigger, error = null) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.error({ trigger, err: error }, 'Starting graceful shutdown');

  stopBackgroundJobs();
  if (gaugePollerTimer) {
    clearInterval(gaugePollerTimer);
    gaugePollerTimer = null;
  }
  try {
    shutdownRealtime();
  } catch (realtimeErr) {
    logger.error({ err: realtimeErr }, 'Error closing realtime SSE subscribers');
  }

  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
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
    logger.error({ err: shutdownError }, 'Error during graceful shutdown');
  } finally {
    clearTimeout(forceExitTimer);
    process.exit(error ? 1 : 0);
  }
}

(async () => {
  try {
    const pgResult = await pool.query('SELECT NOW() AS now');
    logger.info({ dbTime: pgResult.rows[0].now }, 'PostgreSQL connected');

    await ensureSessionTable();

    initRealtime();

    if (isBackgroundJobsEnabled()) {
      await startBackgroundJobs({ pool });
    } else {
      logger.info(
        { RUN_BACKGROUND_JOBS: process.env.RUN_BACKGROUND_JOBS },
        'Background jobs disabled for this process'
      );
    }

    // Gauge poller stays on the API process so /prometheus reflects this replica's pool + DB gauges.
    gaugePollerTimer = startGaugePoller(pool);

    server = app.listen(config.port, () => {
      logger.info(
        { port: config.port, nodeEnv: config.nodeEnv, isProd },
        `LuxRide API server running at http://localhost:${config.port}`
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
      logger.error({ err }, 'Unhandled promise rejection');
      gracefulShutdown('unhandledRejection', err);
    });

    process.on('uncaughtException', (error) => {
      logger.error({ err: error }, 'Uncaught exception');
      gracefulShutdown('uncaughtException', error);
    });
  } catch (err) {
    logger.error({ err }, 'Database/bootstrap connection error');
    process.exit(1);
  }
})();
