/**
 * HTTP access logging (pino-http) plus duration metrics and slow-request warnings.
 * Health and metrics paths are excluded to reduce noise.
 */
const pinoHttp = require('pino-http');
// Require the '../utils/logger' module as logger.
const logger = require('../utils/logger');
// Require the '../monitoring/metrics' module as metrics.
const metrics = require('../monitoring/metrics');
// Require the '../monitoring/logEvent' module as logEvent.
const logEvent = require('../monitoring/logEvent');

// Create the ignore paths constant.
const IGNORE_PATHS = new Set([
  // Supply the literal value used by the enclosing expression.
  '/health',
  // Supply the literal value used by the enclosing expression.
  '/ready',
  // Supply the literal value used by the enclosing expression.
  '/health/live',
  // Supply the literal value used by the enclosing expression.
  '/health/ready',
  // Supply the literal value used by the enclosing expression.
  '/metrics',
  // Supply the literal value used by the enclosing expression.
  '/prometheus',
]);

/** Duration threshold (ms) above which a slow-request warning is emitted. */
const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 1000);

// Create the http logger constant.
const httpLogger = pinoHttp({
  // Contribute this line to the enclosing declaration or statement.
  logger,
  // Provide the gen req id field value.
  genReqId: (req) => req.requestId || req.correlationId,
  // Provide the custom props field value.
  customProps: (req) => ({
    // Provide the request id field value.
    requestId: req.requestId || req.correlationId,
    // Provide the correlation id field value.
    correlationId: req.correlationId,
  }),
  // Provide the serializers field value.
  serializers: {
    // Call req to perform this step.
    req(req) {
      // Create the url constant.
      const url = req.url || '';
      // Create the path only constant.
      const pathOnly = url.split('?')[0];
      // Return the resulting value to the caller.
      return {
        // Provide the method field value.
        method: req.method,
        // Provide the url field value.
        url: pathOnly,
      };
    },
    // Call res to perform this step.
    res(res) {
      // Return the resulting value to the caller.
      return {
        // Provide the status code field value.
        statusCode: res.statusCode,
      };
    },
  },
  // Provide the auto logging field value.
  autoLogging: {
    // Provide the ignore field value.
    ignore: (req) => IGNORE_PATHS.has(req.url?.split('?')[0]),
  },
});

/**
 * Prefer Express route patterns for metrics cardinality; fall back to path with numeric ids collapsed.
 * @param {import('express').Request} req
 * @returns {string} Low-cardinality route label
 */
function resolveRoute(req) {
  // Evaluate the condition and enter the branch when it is true.
  if (req.route?.path) {
    // Create the base constant.
    const base = req.baseUrl || '';
    // Return the resulting value to the caller.
    return `${base}${req.route.path}` || 'unknown';
  }

  // Create the path only constant.
  const pathOnly = (req.path || req.url || '').split('?')[0];
  // Collapse `/orders/123` → `/orders/:id` when no matched route yet.
  return pathOnly.replace(/\/\d+/g, '/:id') || 'unknown';
}

/**
 * Record latency/status metrics on response finish, then delegate to pino-http.
 * Side effects: registers a `finish` listener; may record metrics and warn on slow requests.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {void}
 */
function requestMetrics(req, res, next) {
  // Create the path only constant.
  const pathOnly = (req.url || '').split('?')[0];
  // Evaluate the condition and enter the branch when it is true.
  if (IGNORE_PATHS.has(pathOnly)) {
    // Return the resulting value to the caller.
    return next();
  }

  // Create the start constant.
  const start = process.hrtime.bigint();
  // Call res.on to perform this step.
  res.on('finish', () => {
    // Create the duration ms constant.
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    // Create the route constant.
    const route = resolveRoute(req);
    // Call metrics.recordRequest to perform this step.
    metrics.recordRequest(req.method, req.path, res.statusCode, durationMs, route);

    // Evaluate the condition and enter the branch when it is true.
    if (durationMs >= SLOW_REQUEST_MS) {
      // Call logEvent.warn to perform this step.
      logEvent.warn(
        // Supply the literal value used by the enclosing expression.
        'http.slow_request',
        {
          // Provide the request id field value.
          requestId: req.requestId,
          // Provide the duration ms field value.
          durationMs: Math.round(durationMs),
          // Provide the method field value.
          method: req.method,
          // Provide the path field value.
          path: route,
          // Provide the status code field value.
          statusCode: res.statusCode,
        },
        // Supply the literal value used by the enclosing expression.
        'Slow HTTP request'
      );
    }
  });

  // Return the resulting value to the caller.
  return httpLogger(req, res, next);
}

// Assign the CommonJS module exports.
module.exports = requestMetrics;
