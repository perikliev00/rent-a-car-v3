const path = require('path');
const express = require('express');
const session = require('express-session');
const request = require('supertest');
const { requestContext } = require('../../src/middleware/requestContext');
const { errorHandler, handleNotFound } = require('../../src/middleware/errorHandler');
const { createCorsMiddleware } = require('../../src/config/cors');
const { ensureCsrfToken, requireCsrfToken } = require('../../src/middleware/csrf');
const { optionalApiKeyAuth } = require('../../src/middleware/apiKeyAuth');
const env = require('../../src/config/env');

const SRC_ROOT = path.join(__dirname, '..', '..', 'src');

function bustApiModuleCache() {
  for (const key of Object.keys(require.cache)) {
    if (!key.startsWith(SRC_ROOT)) continue;
    if (
      key.includes(`${path.sep}routes${path.sep}`) ||
      key.includes(`${path.sep}controllers${path.sep}`) ||
      key.includes(`${path.sep}modules${path.sep}`)
    ) {
      delete require.cache[key];
    }
  }
}

function createApiTestApp() {
  env.validateEnv();
  const { config } = env;
  bustApiModuleCache();
  // Fresh require after cache bust so this file's jest.mock() factories bind.
  // eslint-disable-next-line global-require
  const apiRoutes = require('../../src/routes/api');

  const app = express();
  app.use(requestContext);

  const corsMiddleware = createCorsMiddleware(config);
  if (corsMiddleware) {
    app.use(corsMiddleware);
  }

  app.use(express.json());
  app.use(
    session({
      secret: 'test-session-secret',
      resave: false,
      saveUninitialized: true,
      store: new session.MemoryStore(),
    })
  );
  app.use((req, _res, next) => {
    if (!req.session._sid) req.session._sid = req.sessionID;
    next();
  });
  app.use('/api', ensureCsrfToken);
  app.use('/api', optionalApiKeyAuth);
  app.use('/api', requireCsrfToken);
  // Canonical + alias (matches production server.js dual-mount)
  app.use('/api/v1', apiRoutes);
  app.use('/api', apiRoutes);
  app.use(handleNotFound);
  app.use(errorHandler);
  return app;
}

async function initTestAgent(app) {
  const agent = request.agent(app);
  const csrfRes = await agent.get('/api/v1/auth/csrf');
  agent.csrfToken = csrfRes.body.data?.csrfToken;
  return agent;
}

function withCsrf(agent, req) {
  if (agent?.csrfToken) {
    return req.set('X-CSRF-Token', agent.csrfToken);
  }
  return req;
}

module.exports = { createApiTestApp, initTestAgent, withCsrf };
