// Require the 'express' module as express.
const express = require('express');
// Require the 'express-session' module as session.
const session = require('express-session');
// Require the 'connect-pg-simple' module as pgSession.
const pgSession = require('connect-pg-simple')(session);
// Destructure object properties into local variables.
const { requestContext } = require('../../../src/middleware/requestContext');
// Destructure object properties into local variables.
const { errorHandler, handleNotFound } = require('../../../src/middleware/errorHandler');
// Destructure object properties into local variables.
const { createCorsMiddleware } = require('../../../src/config/cors');
// Destructure object properties into local variables.
const { ensureCsrfToken, requireCsrfToken } = require('../../../src/middleware/csrf');
// Destructure object properties into local variables.
const { optionalApiKeyAuth } = require('../../../src/middleware/apiKeyAuth');
// Require the '../../../src/controllers/payment' module as paymentController.
const paymentController = require('../../../src/controllers/payment');
// Require the '../../../src/config/env' module as env.
const env = require('../../../src/config/env');
// Destructure object properties into local variables.
const { pool } = require('../../helpers/dbTestHarness');

// Reserve the cached api routes variable for later assignment.
let cachedApiRoutes;

// Define the getApiRoutes function.
function getApiRoutes() {
  // Evaluate the condition and enter the branch when it is true.
  if (!cachedApiRoutes) {
    // Update cachedApiRoutes with the right-hand side value.
    cachedApiRoutes = require('../../../src/routes/api');
  }
  // Return the resulting value to the caller.
  return cachedApiRoutes;
}

// Define the createSessionStore function.
function createSessionStore(usePgSessionStore) {
  // Evaluate the condition and enter the branch when it is true.
  if (!usePgSessionStore) {
    // Return the resulting value to the caller.
    return new session.MemoryStore();
  }
  // Return the resulting value to the caller.
  return new pgSession({
    // Contribute this line to the enclosing declaration or statement.
    pool,
    // Provide the table name field value.
    tableName: 'session',
    // Provide the create table if missing field value.
    createTableIfMissing: true,
  });
}

// Define the createIntegrationTestApp function.
function createIntegrationTestApp({ usePgSessionStore = false } = {}) {
  // Call env.validateEnv to perform this step.
  env.validateEnv();
  // Destructure object properties into local variables.
  const { config } = env;
  // Create the app constant.
  const app = express();
  // Call app.use to perform this step.
  app.use(requestContext);

  // Create the cors middleware constant.
  const corsMiddleware = createCorsMiddleware(config);
  // Evaluate the condition and enter the branch when it is true.
  if (corsMiddleware) {
    // Call app.use to perform this step.
    app.use(corsMiddleware);
  }

  // Call app.post to perform this step.
  app.post(
    // Supply the literal value used by the enclosing expression.
    '/webhook/stripe',
    // Call express.raw to perform this step.
    express.raw({ type: 'application/json' }),
    // Contribute this line to the enclosing declaration or statement.
    paymentController.handleStripeWebhook
  );

  // Call app.use to perform this step.
  app.use(express.json());
  // Call app.use to perform this step.
  app.use(
    // Call session to perform this step.
    session({
      // Provide the secret field value.
      secret: process.env.SESSION_SECRET || 'test-session-secret-32-chars-minimum!!',
      // Provide the resave field value.
      resave: false,
      // Provide the save uninitialized field value.
      saveUninitialized: true,
      // Provide the store field value.
      store: createSessionStore(usePgSessionStore),
    })
  );
  // Call app.use to perform this step.
  app.use((req, _res, next) => {
    // Evaluate the condition and enter the branch when it is true.
    if (!req.session._sid) req.session._sid = req.sessionID;
    // Call next to perform this step.
    next();
  });
  // Call app.use to perform this step.
  app.use('/api', ensureCsrfToken);
  // Call app.use to perform this step.
  app.use('/api', optionalApiKeyAuth);
  // Call app.use to perform this step.
  app.use('/api', requireCsrfToken);
  // Call app.use to perform this step.
  app.use('/api/v1', getApiRoutes());
  // Call app.use to perform this step.
  app.use('/api', getApiRoutes());
  // Call app.use to perform this step.
  app.use(handleNotFound);
  // Call app.use to perform this step.
  app.use(errorHandler);
  // Return the resulting value to the caller.
  return app;
}

// Assign the CommonJS module exports.
module.exports = { createIntegrationTestApp };
