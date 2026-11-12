/**
 * Swagger UI and OpenAPI JSON; enabled in non-prod, staff-gated when enabled in production.
 */
const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { getOpenApiDocument } = require('../../config/openapi');
const { requireStaffApi } = require('../../middleware/auth');
const env = require('../../config/env');

const router = express.Router();

/**
 * Docs are always on outside production; in production require OPENAPI_DOCS_ENABLED.
 * @returns {boolean} Whether OpenAPI/Swagger routes should serve content
 */
function docsEnabled() {
  const { config } = env;
  if (!config.isProd) {
    return true;
  }
  return ['true', '1', 'yes'].includes(
    String(process.env.OPENAPI_DOCS_ENABLED || '').toLowerCase()
  );
}

// Hide docs entirely when disabled (404 rather than 403 to avoid advertising the path).
router.use((req, res, next) => {
  if (!docsEnabled()) {
    return res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'The requested resource was not found.',
      },
    });
  }
  return next();
});

// Production: only staff sessions may open Swagger / openapi.json.
router.use((req, res, next) => {
  const { config } = env;
  if (config.isProd) {
    return requireStaffApi(req, res, next);
  }
  return next();
});

// Raw merged OpenAPI document for codegen / clients.
router.get('/openapi.json', (_req, res) => {
  res.json(getOpenApiDocument());
});

const swaggerDocument = getOpenApiDocument();

// Interactive Swagger UI at /docs/.
router.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'LuxRide API Docs',
  })
);

module.exports = router;
