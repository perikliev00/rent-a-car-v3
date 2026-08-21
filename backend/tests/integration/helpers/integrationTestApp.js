const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const { requestContext } = require('../../../src/middleware/requestContext');
const { errorHandler, handleNotFound } = require('../../../src/middleware/errorHandler');
const { createCorsMiddleware } = require('../../../src/config/cors');
const { ensureCsrfToken, requireCsrfToken } = require('../../../src/middleware/csrf');
const { optionalApiKeyAuth } = require('../../../src/middleware/apiKeyAuth');
const paymentController = require('../../../src/controllers/payment');
const env = require('../../../src/config/env');
const { pool } = require('../../helpers/dbTestHarness');

let cachedApiRoutes;

function getApiRoutes() {
  if (!cachedApiRoutes) {
    cachedApiRoutes = require('../../../src/routes/api');
  }
  return cachedApiRoutes;
}

function createSessionStore(usePgSessionStore) {
  if (!usePgSessionStore) {
    return new session.MemoryStore();
  }
  return new pgSession({
    pool,
    tableName: 'session',
    createTableIfMissing: true,
  });
}

function createIntegrationTestApp({ usePgSessionStore = false } = {}) {
  env.validateEnv();
  const { config } = env;
  const app = express();
  app.use(requestContext);

  const corsMiddleware = createCorsMiddleware(config);
  if (corsMiddleware) {
    app.use(corsMiddleware);
  }

  app.post(
    '/webhook/stripe',
    express.raw({ type: 'application/json' }),
    paymentController.handleStripeWebhook
  );

  app.use(express.json());
  app.use(
    session({
      secret: process.env.SESSION_SECRET || 'test-session-secret-32-chars-minimum!!',
      resave: false,
      saveUninitialized: true,
      store: createSessionStore(usePgSessionStore),
    })
  );
  app.use((req, _res, next) => {
    if (!req.session._sid) req.session._sid = req.sessionID;
    next();
  });
  app.use('/api', ensureCsrfToken);
  app.use('/api', optionalApiKeyAuth);
  app.use('/api', requireCsrfToken);
  app.use('/api/v1', getApiRoutes());
  app.use('/api', getApiRoutes());
  app.use(handleNotFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createIntegrationTestApp };
