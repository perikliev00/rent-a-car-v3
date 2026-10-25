/**
 * LuxRide HTTP API process: Express app bootstrap, session store, health/metrics,
 * versioned API mounts, optional in-process background jobs, and graceful shutdown.
 *
 * Side effects at load: validates env, initializes Sentry, builds the Express app,
 * and starts an async bootstrap IIFE that connects to Postgres and listens.
 */
require('dotenv').config();

const env = require('./config/env');
// Fail fast before any listeners or DB clients are created.
env.validateEnv();
const { config } = env;

const { initSentry } = require('./config/sentry');
// No-op when SENTRY_DSN is unset; must run before request handling.
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
  adminReadLimiter,
  adminWriteLimiter,
  adminRealtimeLimiter,
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
const { initRealtime, shutdownRealtime, hub: realtimeHub } = require('./modules/realtime');
const { lookupSessionAccess } = require('./modules/realtime/realtime.sessionLookup');
const {
  startUploadTempJanitor,
  stopUploadTempJanitor,
} = require('./services/storage/imageCleanupService');
const { isBackgroundJobsEnabled } = require('./config/backgroundJobs');
const {
  startBackgroundJobs,
  stopBackgroundJobs,
} = require('./jobs/backgroundJobRunner');

const app = express();
/** Idle session lifetime (ms); also drives cookie maxAge and Postgres session TTL. */
const SESSION_IDLE_MS = 20 * 60 * 1000;
const isProd = config.isProd;
let server = null;
let isShuttingDown = false;
let gaugePollerTimer = null;

// Correlation id for logs/metrics before any business handlers run.
app.use(requestIdMiddleware);
// Record request latency/status for /metrics and Prometheus.
app.use(requestMetrics);
// Reject new work once graceful shutdown has begun.
app.use(createShutdownGate(() => isShuttingDown));

const corsMiddleware = createCorsMiddleware(config);
// Skip CORS entirely when no origins are allowed (typical locked-down prod misconfig guard).
if (corsMiddleware) {
  app.use(corsMiddleware);
}

// Public car images served from the API host (local disk / synced assets).
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Stripe webhooks need the raw body for signature verification — mount before JSON parsers.
app.post(
  '/webhook/stripe',
  express.raw({ type: 'application/json' }),
  paymentController.handleStripeWebhook
);

app.use(bodyParser.json());
// Helmet + Permissions-Policy; HSTS only in production.
applySecurity(app, { isProd });

// Liveness: process is up (no dependency checks).
app.get('/health/live', (req, res) => {
  res.json(getLiveStatus());
});

// Readiness: DB (and related) must be reachable; 503 when not ready.
app.get('/health/ready', async (req, res, next) => {
  try {
    const payload = await getReadyStatus(pool);
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  } catch (err) {
    next(err);
  }
});

// Alias of /health/live for older probes.
app.get('/health', (req, res) => {
  res.json(getLiveStatus());
});

// Alias of /health/ready for older probes.
app.get('/ready', async (req, res, next) => {
  try {
    const payload = await getReadyStatus(pool);
    res.status(payload.status === 'ready' ? 200 : 503).json(payload);
  } catch (err) {
    next(err);
  }
});

// JSON metrics snapshot; gated by metrics token middleware.
app.get('/metrics', requireMetricsToken, (req, res) => {
  res.json(metrics.getSnapshot());
});

// Prometheus text exposition; same token gate as /metrics.
app.get('/prometheus', requireMetricsToken, async (req, res, next) => {
  try {
    res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
    res.send(await metrics.getPrometheusMetrics());
  } catch (err) {
    next(err);
  }
});

// Persist express-session rows in Postgres (shared across API replicas).
const store = new pgSession({
  pool,
  tableName: 'session',
  createTableIfMissing: false,
  ttl: Math.floor(SESSION_IDLE_MS / 1000),
  pruneSessionInterval: 15 * 60,
});

store.on('error', (err) => {
  logger.error({ err }, 'Session store error');
});

// Needed so secure cookies work behind a reverse proxy / load balancer.
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
    // Extend cookie on activity within the idle window.
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: config.sessionCookieSameSite,
      secure: config.sessionCookieSecure,
      maxAge: SESSION_IDLE_MS,
    },
  })
);

// Ensure payment-flag and session-id mirror fields exist for downstream handlers.
app.use((req, _res, next) => {
  if (!req.session.isPaid) req.session.isPaid = false;
  if (req.session._sid !== req.sessionID) req.session._sid = req.sessionID;
  next();
});

// Issue CSRF cookie/token on API traffic before auth/key checks.
app.use('/api', ensureCsrfToken);
// Optional X-API-Key elevates auth context when present and valid.
app.use('/api', optionalApiKeyAuth);
// Reject state-changing API calls without a matching CSRF token.
app.use('/api', requireCsrfToken);

/**
 * Mount shared API routes under a path prefix with endpoint-specific rate limiters.
 * Side effects: registers multiple `app.use` middleware stacks for the given prefix.
 * @param {string} prefix - e.g. `/api/v1` or `/api`
 * @returns {void}
 */
function mountVersionedApi(prefix) {
  // Checkout session creation is expensive and abuse-prone.
  app.use(`${prefix}/checkout`, checkoutLimiter);
  // Order/reservation writes share booking limits.
  app.use(`${prefix}/orders`, bookingLimiter);
  app.use(`${prefix}/reservations`, bookingLimiter);
  app.use(`${prefix}/chat`, chatLimiter);
  app.use(`${prefix}/contacts`, contactLimiter);
  // Admin stack: read/write/realtime limiters layered for method-aware throttling.
  app.use(
    `${prefix}/admin`,
    adminReadLimiter,
    adminWriteLimiter,
    adminRealtimeLimiter
  );
  app.use(prefix, apiRoutes);
}

// Canonical versioned API + backward-compatible unversioned alias.
mountVersionedApi('/api/v1');
mountVersionedApi('/api');
// Catch-all 404 JSON for unmatched routes.
app.use(handleNotFound);
// Centralized error → JSON (+ Sentry when configured).
app.use(errorHandler);

/**
 * Stop accepting work, tear down jobs/realtime/HTTP/pool, then exit.
 * Idempotent: concurrent signals after the first are ignored.
 * Side effects: clears timers, stops jobs/realtime, closes HTTP server and pool, `process.exit`.
 * @param {string} trigger - Signal or error name that initiated shutdown
 * @param {Error|null} [error=null] - When set, process exits with code 1
 * @returns {Promise<void>}
 */
async function gracefulShutdown(trigger, error = null) {
  // Guard against overlapping SIGINT/SIGTERM/unhandled handlers.
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  logger.error({ trigger, err: error }, 'Starting graceful shutdown');

  stopBackgroundJobs();
  stopUploadTempJanitor();
  // Stop gauge poller so we do not keep querying a closing pool.
  if (gaugePollerTimer) {
    clearInterval(gaugePollerTimer);
    gaugePollerTimer = null;
  }
  try {
    shutdownRealtime();
  } catch (realtimeErr) {
    logger.error({ err: realtimeErr }, 'Error closing realtime SSE subscribers');
  }

  // Hard deadline so a stuck close cannot hang the process forever.
  const forceExitTimer = setTimeout(() => {
    logger.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(error ? 1 : 0);
  }, 10000);
  // Do not keep the event loop alive solely for the force-exit timer.
  forceExitTimer.unref?.();

  try {
    if (server) {
      // Stop accepting new connections; wait for in-flight requests to finish.
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
    // Verify DB connectivity before advertising the server as ready.
    const pgResult = await pool.query('SELECT NOW() AS now');
    logger.info({ dbTime: pgResult.rows[0].now }, 'PostgreSQL connected');

    // Ensure connect-pg-simple table exists even if createTableIfMissing races.
    await ensureSessionTable();

    // Wire SSE/realtime hub used by admin clients.
    initRealtime();
    realtimeHub.setSessionLookup(lookupSessionAccess);

    // Multi-replica setups disable jobs here and run `worker.js` instead.
    if (isBackgroundJobsEnabled()) {
      await startBackgroundJobs({ pool });
    } else {
      // The API container owns uploads/tmp. The worker janitor cannot see it.
      startUploadTempJanitor();
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

    // Container / local Ctrl+C.
    process.on('SIGINT', () => {
      gracefulShutdown('SIGINT');
    });

    // Orchestrator rolling deploy / stop.
    process.on('SIGTERM', () => {
      gracefulShutdown('SIGTERM');
    });

    // Treat unhandled rejections as fatal to avoid inconsistent state.
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
