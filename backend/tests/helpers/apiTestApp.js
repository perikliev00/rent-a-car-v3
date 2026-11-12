// Require the 'path' module as path.
const path = require('path');
// Require the 'express' module as express.
const express = require('express');
// Require the 'express-session' module as session.
const session = require('express-session');
// Require the 'supertest' module as request.
const request = require('supertest');
// Destructure object properties into local variables.
const { requestContext } = require('../../src/middleware/requestContext');
// Destructure object properties into local variables.
const { errorHandler, handleNotFound } = require('../../src/middleware/errorHandler');
// Destructure object properties into local variables.
const { createCorsMiddleware } = require('../../src/config/cors');
// Destructure object properties into local variables.
const { ensureCsrfToken, requireCsrfToken } = require('../../src/middleware/csrf');
// Destructure object properties into local variables.
const { optionalApiKeyAuth } = require('../../src/middleware/apiKeyAuth');
// Require the '../../src/config/env' module as env.
const env = require('../../src/config/env');

// Create the src root constant.
const SRC_ROOT = path.join(__dirname, '..', '..', 'src');

// Define the bustApiModuleCache function.
function bustApiModuleCache() {
  // Iterate using the loop initializer, condition, and step.
  for (const key of Object.keys(require.cache)) {
    // Evaluate the condition and enter the branch when it is true.
    if (!key.startsWith(SRC_ROOT)) continue;
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Call key.includes to perform this step.
      key.includes(`${path.sep}routes${path.sep}`) ||
      // Call key.includes to perform this step.
      key.includes(`${path.sep}controllers${path.sep}`) ||
      // Call key.includes to perform this step.
      key.includes(`${path.sep}modules${path.sep}`)
    // Continue the surrounding logic with this statement.
    ) {
      // Delete the specified property from the object.
      delete require.cache[key];
    }
  }
}

// Define the createApiTestApp function.
function createApiTestApp() {
  // Call env.validateEnv to perform this step.
  env.validateEnv();
  // Destructure object properties into local variables.
  const { config } = env;
  // Call bustApiModuleCache to perform this step.
  bustApiModuleCache();
  // Fresh require after cache bust so this file's jest.mock() factories bind.
  // eslint-disable-next-line global-require
  const apiRoutes = require('../../src/routes/api');

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

  // Call app.use to perform this step.
  app.use(express.json());
  // Call app.use to perform this step.
  app.use(
    // Call session to perform this step.
    session({
      // Provide the secret field value.
      secret: 'test-session-secret',
      // Provide the resave field value.
      resave: false,
      // Provide the save uninitialized field value.
      saveUninitialized: true,
      // Provide the store field value.
      store: new session.MemoryStore(),
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
  // Canonical + alias (matches production server.js dual-mount)
  app.use('/api/v1', apiRoutes);
  // Call app.use to perform this step.
  app.use('/api', apiRoutes);
  // Call app.use to perform this step.
  app.use(handleNotFound);
  // Call app.use to perform this step.
  app.use(errorHandler);
  // Return the resulting value to the caller.
  return app;
}

// Define the async function initTestAgent.
async function initTestAgent(app) {
  // Create the agent constant.
  const agent = request.agent(app);
  // Create the csrf res constant.
  const csrfRes = await agent.get('/api/v1/auth/csrf');
  // Update agent.csrfToken with the right-hand side value.
  agent.csrfToken = csrfRes.body.data?.csrfToken;
  // Return the resulting value to the caller.
  return agent;
}

// Define the withCsrf function.
function withCsrf(agent, req) {
  // Evaluate the condition and enter the branch when it is true.
  if (agent?.csrfToken) {
    // Return the resulting value to the caller.
    return req.set('X-CSRF-Token', agent.csrfToken);
  }
  // Return the resulting value to the caller.
  return req;
}

// Assign the CommonJS module exports.
module.exports = { createApiTestApp, initTestAgent, withCsrf };
