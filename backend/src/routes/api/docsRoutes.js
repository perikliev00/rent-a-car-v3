const express = require('express');
const swaggerUi = require('swagger-ui-express');
const { getOpenApiDocument } = require('../../config/openapi');
const { requireStaffApi } = require('../../middleware/auth');
const env = require('../../config/env');

const router = express.Router();

function docsEnabled() {
  const { config } = env;
  if (!config.isProd) {
    return true;
  }
  return ['true', '1', 'yes'].includes(
    String(process.env.OPENAPI_DOCS_ENABLED || '').toLowerCase()
  );
}

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

router.use((req, res, next) => {
  const { config } = env;
  if (config.isProd) {
    return requireStaffApi(req, res, next);
  }
  return next();
});

router.get('/openapi.json', (_req, res) => {
  res.json(getOpenApiDocument());
});

const swaggerDocument = getOpenApiDocument();

router.use(
  '/',
  swaggerUi.serve,
  swaggerUi.setup(swaggerDocument, {
    customSiteTitle: 'LuxRide API Docs',
  })
);

module.exports = router;
