/**
 * LuxRide HTTP API process: Express app bootstrap, session store, health/metrics,
 * versioned API mounts, optional in-process background jobs, and graceful shutdown.
 *
 * Side effects at load: validates env, initializes Sentry, builds the Express app,
 * and starts an async bootstrap IIFE that connects to Postgres and listens.
 */
require('dotenv').config();

// Require the './config/env' module as env.
const env = require('./config/env');
// Fail fast before any listeners or DB clients are created.
env.validateEnv();
// Destructure object properties into local variables.
const { config } = env;

// Destructure object properties into local variables.
const { initSentry } = require('./config/sentry');
// No-op when SENTRY_DSN is unset; must run before request handling.
initSentry();

// Require the 'express' module as express.
const express = require('express');
// Require the 'path' module as path.
const path = require('path');
// Require the './db/pool' module as pool.
const pool = require('./db/pool');
// Require the './utils/logger' module as logger.
const logger = require('./utils/logger');
// Require the './monitoring/metrics' module as metrics.
const metrics = require('./monitoring/metrics');
// Require the 'body-parser' module as bodyParser.
const bodyParser = require('body-parser');
// Require the 'express-session' module as session.
const session = require('express-session');
// Require the 'connect-pg-simple' module as pgSession.
const pgSession = require('connect-pg-simple')(session);
// Require the './controllers/payment' module as paymentController.
const paymentController = require('./controllers/payment');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  adminReadLimiter,
  // Contribute this line to the enclosing declaration or statement.
  adminWriteLimiter,
  // Contribute this line to the enclosing declaration or statement.
  adminRealtimeLimiter,
  // Contribute this line to the enclosing declaration or statement.
  checkoutLimiter,
  // Contribute this line to the enclosing declaration or statement.
  bookingLimiter,
  // Contribute this line to the enclosing declaration or statement.
  chatLimiter,
  // Contribute this line to the enclosing declaration or statement.
  contactLimiter,
// Continue the surrounding logic with this statement.
} = require('./middleware/rateLimit');
// Destructure object properties into local variables.
const { ensureCsrfToken, requireCsrfToken, getCsrfToken } = require('./middleware/csrf');
// Destructure object properties into local variables.
const { optionalApiKeyAuth } = require('./middleware/apiKeyAuth');
// Require the './config/security' module as applySecurity.
const applySecurity = require('./config/security');
// Destructure object properties into local variables.
const { requestIdMiddleware } = require('./middleware/requestIdMiddleware');
// Require the './middleware/requestMetrics' module as requestMetrics.
const requestMetrics = require('./middleware/requestMetrics');
// Destructure object properties into local variables.
const { getLiveStatus, getReadyStatus } = require('./services/healthService');
// Destructure object properties into local variables.
const { startGaugePoller } = require('./monitoring/gaugePoller');
// Destructure object properties into local variables.
const { createCorsMiddleware } = require('./config/cors');
// Require the './middleware/requireMetricsToken' module as requireMetricsToken.
const requireMetricsToken = require('./middleware/requireMetricsToken');
// Destructure object properties into local variables.
const { handleNotFound, errorHandler } = require('./middleware/errorHandler');
// Destructure object properties into local variables.
const { createShutdownGate } = require('./middleware/shutdownGate');
// Require the './routes/api' module as apiRoutes.
const apiRoutes = require('./routes/api');

// Destructure object properties into local variables.
const { ensureSessionTable } = require('./services/sql/sessionSqlService');
// Destructure object properties into local variables.
const { initRealtime, shutdownRealtime, hub: realtimeHub } = require('./modules/realtime');
// Destructure object properties into local variables.
const { lookupSessionAccess } = require('./modules/realtime/realtime.sessionLookup');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  startUploadTempJanitor,
  // Contribute this line to the enclosing declaration or statement.
  stopUploadTempJanitor,
// Continue the surrounding logic with this statement.
} = require('./services/storage/imageCleanupService');
// Destructure object properties into local variables.
const { isBackgroundJobsEnabled } = require('./config/backgroundJobs');
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
/** Idle session lifetime (ms); also drives cookie maxAge and Postgres session TTL. */
const SESSION_IDLE_MS = 20 * 60 * 1000;
// Create the is prod constant.
const isProd = config.isProd;
// Initialize the mutable server variable.
let server = null;
// Initialize the mutable is shutting down variable.
let isShuttingDown = false;
// Initialize the mutable gauge poller timer variable.
let gaugePollerTimer = null;

// Correlation id for logs/metrics before any business handlers run.
app.use(requestIdMiddleware);
// Record request latency/status for /metrics and Prometheus.
app.use(requestMetrics);
// Reject new work once graceful shutdown has begun.
app.use(createShutdownGate(() => isShuttingDown));

// Create the cors middleware constant.
const corsMiddleware = createCorsMiddleware(config);
// Skip CORS entirely when no origins are allowed (typical locked-down prod misconfig guard).
if (corsMiddleware) {
  // Call app.use to perform this step.
  app.use(corsMiddleware);
}

// Public car images served from the API host (local disk / synced assets).
app.use('/images', express.static(path.join(__dirname, 'public/images')));

// Stripe webhooks need the raw body for signature verification — mount before JSON parsers.
app.post(
  // Supply the literal value used by the enclosing expression.
  '/webhook/stripe',
  // Call express.raw to perform this step.
  express.raw({ type: 'application/json' }),
  // Contribute this line to the enclosing declaration or statement.
  paymentController.handleStripeWebhook
);

// Call app.use to perform this step.
app.use(bodyParser.json());
// Helmet + Permissions-Policy; HSTS only in production.
applySecurity(app, { isProd });

// Liveness: process is up (no dependency checks).
app.get('/health/live', (req, res) => {
  // Call res.json to perform this step.
  res.json(getLiveStatus());
});

// Readiness: DB (and related) must be reachable; 503 when not ready.
app.get('/health/ready', async (req, res, next) => {
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

// Alias of /health/live for older probes.
app.get('/health', (req, res) => {
  // Call res.json to perform this step.
  res.json(getLiveStatus());
});

// Alias of /health/ready for older probes.
app.get('/ready', async (req, res, next) => {
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

// JSON metrics snapshot; gated by metrics token middleware.
app.get('/metrics', requireMetricsToken, (req, res) => {
  // Call res.json to perform this step.
  res.json(metrics.getSnapshot());
});

// Prometheus text exposition; same token gate as /metrics.
app.get('/prometheus', requireMetricsToken, async (req, res, next) => {
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

// Persist express-session rows in Postgres (shared across API replicas).
const store = new pgSession({
  // Contribute this line to the enclosing declaration or statement.
  pool,
  // Provide the table name field value.
  tableName: 'session',
  // Provide the create table if missing field value.
  createTableIfMissing: false,
  // Provide the ttl field value.
  ttl: Math.floor(SESSION_IDLE_MS / 1000),
  // Provide the prune session interval field value.
  pruneSessionInterval: 15 * 60,
});

// Call store.on to perform this step.
store.on('error', (err) => {
  // Call logger.error to perform this step.
  logger.error({ err }, 'Session store error');
});

// Needed so secure cookies work behind a reverse proxy / load balancer.
if (isProd) {
  // Call app.set to perform this step.
  app.set('trust proxy', 1);
}

// Call app.use to perform this step.
app.use(
  // Call session to perform this step.
  session({
    // Provide the name field value.
    name: 'sid',
    // Provide the secret field value.
    secret: config.sessionSecret,
    // Contribute this line to the enclosing declaration or statement.
    store,
    // Provide the resave field value.
    resave: false,
    // Provide the save uninitialized field value.
    saveUninitialized: false,
    // Extend cookie on activity within the idle window.
    rolling: true,
    // Provide the cookie field value.
    cookie: {
      // Provide the http only field value.
      httpOnly: true,
      // Provide the same site field value.
      sameSite: config.sessionCookieSameSite,
      // Provide the secure field value.
      secure: config.sessionCookieSecure,
      // Provide the max age field value.
      maxAge: SESSION_IDLE_MS,
    },
  })
);

// Ensure payment-flag and session-id mirror fields exist for downstream handlers.
app.use((req, _res, next) => {
  // Evaluate the condition and enter the branch when it is true.
  if (!req.session.isPaid) req.session.isPaid = false;
  // Evaluate the condition and enter the branch when it is true.
  if (req.session._sid !== req.sessionID) req.session._sid = req.sessionID;
  // Call next to perform this step.
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
  // Call app.use to perform this step.
  app.use(`${prefix}/reservations`, bookingLimiter);
  // Call app.use to perform this step.
  app.use(`${prefix}/chat`, chatLimiter);
  // Call app.use to perform this step.
  app.use(`${prefix}/contacts`, contactLimiter);
  // Admin stack: read/write/realtime limiters layered for method-aware throttling.
  app.use(
    // Continue the surrounding logic with this statement.
    `${prefix}/admin`,
    // Contribute this line to the enclosing declaration or statement.
    adminReadLimiter,
    // Contribute this line to the enclosing declaration or statement.
    adminWriteLimiter,
    // Reference the identifier used by the enclosing expression.
    adminRealtimeLimiter
  );
  // Call app.use to perform this step.
  app.use(prefix, apiRoutes);
}

// Canonical versioned API + backward-compatible unversioned alias.
mountVersionedApi('/api/v1');
// Call mountVersionedApi to perform this step.
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
    // Return control to the caller with the following value.
    return;
  }

  // Update isShuttingDown with the right-hand side value.
  isShuttingDown = true;
  // Call logger.error to perform this step.
  logger.error({ trigger, err: error }, 'Starting graceful shutdown');

  // Call stopBackgroundJobs to perform this step.
  stopBackgroundJobs();
  // Call stopUploadTempJanitor to perform this step.
  stopUploadTempJanitor();
  // Stop gauge poller so we do not keep querying a closing pool.
  if (gaugePollerTimer) {
    // Call clearInterval to perform this step.
    clearInterval(gaugePollerTimer);
    // Update gaugePollerTimer with the right-hand side value.
    gaugePollerTimer = null;
  }
  // Start a try block for operations that may fail.
  try {
    // Call shutdownRealtime to perform this step.
    shutdownRealtime();
  // Continue the surrounding logic with this statement.
  } catch (realtimeErr) {
    // Call logger.error to perform this step.
    logger.error({ err: realtimeErr }, 'Error closing realtime SSE subscribers');
  }

  // Hard deadline so a stuck close cannot hang the process forever.
  const forceExitTimer = setTimeout(() => {
    // Call logger.error to perform this step.
    logger.error('Graceful shutdown timed out. Forcing exit.');
    // Call process.exit to perform this step.
    process.exit(error ? 1 : 0);
  // Continue the surrounding logic with this statement.
  }, 10000);
  // Do not keep the event loop alive solely for the force-exit timer.
  forceExitTimer.unref?.();

  // Start a try block for operations that may fail.
  try {
    // Evaluate the condition and enter the branch when it is true.
    if (server) {
      // Stop accepting new connections; wait for in-flight requests to finish.
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
    logger.error({ err: shutdownError }, 'Error during graceful shutdown');
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
    // Verify DB connectivity before advertising the server as ready.
    const pgResult = await pool.query('SELECT NOW() AS now');
    // Call logger.info to perform this step.
    logger.info({ dbTime: pgResult.rows[0].now }, 'PostgreSQL connected');

    // Ensure connect-pg-simple table exists even if createTableIfMissing races.
    await ensureSessionTable();

    // Wire SSE/realtime hub used by admin clients.
    initRealtime();
    // Call realtimeHub.setSessionLookup to perform this step.
    realtimeHub.setSessionLookup(lookupSessionAccess);

    // Multi-replica setups disable jobs here and run `worker.js` instead.
    if (isBackgroundJobsEnabled()) {
      // Wait until the asynchronous operation resolves.
      await startBackgroundJobs({ pool });
    // Contribute this line to the enclosing declaration or statement.
    } else {
      // The API container owns uploads/tmp. The worker janitor cannot see it.
      startUploadTempJanitor();
      // Call logger.info to perform this step.
      logger.info(
        // Contribute this line to the enclosing declaration or statement.
        { RUN_BACKGROUND_JOBS: process.env.RUN_BACKGROUND_JOBS },
        // Supply the literal value used by the enclosing expression.
        'Background jobs disabled for this process'
      );
    }

    // Gauge poller stays on the API process so /prometheus reflects this replica's pool + DB gauges.
    gaugePollerTimer = startGaugePoller(pool);

    // Update server with the right-hand side value.
    server = app.listen(config.port, () => {
      // Call logger.info to perform this step.
      logger.info(
        // Contribute this line to the enclosing declaration or statement.
        { port: config.port, nodeEnv: config.nodeEnv, isProd },
        // Continue the surrounding logic with this statement.
        `LuxRide API server running at http://localhost:${config.port}`
      );
    });

    // Container / local Ctrl+C.
    process.on('SIGINT', () => {
      // Call gracefulShutdown to perform this step.
      gracefulShutdown('SIGINT');
    });

    // Orchestrator rolling deploy / stop.
    process.on('SIGTERM', () => {
      // Call gracefulShutdown to perform this step.
      gracefulShutdown('SIGTERM');
    });

    // Treat unhandled rejections as fatal to avoid inconsistent state.
    process.on('unhandledRejection', (reason) => {
      // Create the err constant.
      const err = reason instanceof Error ? reason : new Error(String(reason));
      // Call logger.error to perform this step.
      logger.error({ err }, 'Unhandled promise rejection');
      // Call gracefulShutdown to perform this step.
      gracefulShutdown('unhandledRejection', err);
    });

    // Call process.on to perform this step.
    process.on('uncaughtException', (error) => {
      // Call logger.error to perform this step.
      logger.error({ err: error }, 'Uncaught exception');
      // Call gracefulShutdown to perform this step.
      gracefulShutdown('uncaughtException', error);
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Call logger.error to perform this step.
    logger.error({ err }, 'Database/bootstrap connection error');
    // Call process.exit to perform this step.
    process.exit(1);
  }
// Continue the surrounding logic with this statement.
})();
