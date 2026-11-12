/**
 * Swagger UI and OpenAPI JSON; enabled in non-prod, staff-gated when enabled in production.
 */
const express = require('express');
// Require the 'swagger-ui-express' module as swaggerUi.
const swaggerUi = require('swagger-ui-express');
// Destructure object properties into local variables.
const { getOpenApiDocument } = require('../../config/openapi');
// Destructure object properties into local variables.
const { requireStaffApi } = require('../../middleware/auth');
// Require the '../../config/env' module as env.
const env = require('../../config/env');

// Create the router constant.
const router = express.Router();

/**
 * Docs are always on outside production; in production require OPENAPI_DOCS_ENABLED.
 * @returns {boolean} Whether OpenAPI/Swagger routes should serve content
 */
function docsEnabled() {
  // Destructure object properties into local variables.
  const { config } = env;
  // Evaluate the condition and enter the branch when it is true.
  if (!config.isProd) {
    // Return the resulting value to the caller.
    return true;
  }
  // Return the resulting value to the caller.
  return ['true', '1', 'yes'].includes(
    // Call String to perform this step.
    String(process.env.OPENAPI_DOCS_ENABLED || '').toLowerCase()
  );
}

// Hide docs entirely when disabled (404 rather than 403 to avoid advertising the path).
router.use((req, res, next) => {
  // Evaluate the condition and enter the branch when it is true.
  if (!docsEnabled()) {
    // Return the resulting value to the caller.
    return res.status(404).json({
      // Provide the success field value.
      success: false,
      // Provide the error field value.
      error: {
        // Provide the code field value.
        code: 'NOT_FOUND',
        // Provide the message field value.
        message: 'The requested resource was not found.',
      },
    });
  }
  // Return the resulting value to the caller.
  return next();
});

// Production: only staff sessions may open Swagger / openapi.json.
router.use((req, res, next) => {
  // Destructure object properties into local variables.
  const { config } = env;
  // Evaluate the condition and enter the branch when it is true.
  if (config.isProd) {
    // Return the resulting value to the caller.
    return requireStaffApi(req, res, next);
  }
  // Return the resulting value to the caller.
  return next();
});

// Raw merged OpenAPI document for codegen / clients.
router.get('/openapi.json', (_req, res) => {
  // Call res.json to perform this step.
  res.json(getOpenApiDocument());
});

// Create the swagger document constant.
const swaggerDocument = getOpenApiDocument();

// Interactive Swagger UI at /docs/.
router.use(
  // Supply the literal value used by the enclosing expression.
  '/',
  // Contribute this line to the enclosing declaration or statement.
  swaggerUi.serve,
  // Call swaggerUi.setup to perform this step.
  swaggerUi.setup(swaggerDocument, {
    // Provide the custom site title field value.
    customSiteTitle: 'LuxRide API Docs',
  })
);

// Assign the CommonJS module exports.
module.exports = router;
