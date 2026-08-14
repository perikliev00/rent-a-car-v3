const pinoHttp = require('pino-http');
const logger = require('../utils/logger');
const metrics = require('../monitoring/metrics');
const logEvent = require('../monitoring/logEvent');

const IGNORE_PATHS = new Set([
  '/health',
  '/ready',
  '/health/live',
  '/health/ready',
  '/metrics',
  '/prometheus',
]);

const SLOW_REQUEST_MS = Number(process.env.SLOW_REQUEST_MS || 1000);

const httpLogger = pinoHttp({
  logger,
  genReqId: (req) => req.requestId || req.correlationId,
  customProps: (req) => ({
    requestId: req.requestId || req.correlationId,
    correlationId: req.correlationId,
  }),
  serializers: {
    req(req) {
      const url = req.url || '';
      const pathOnly = url.split('?')[0];
      return {
        method: req.method,
        url: pathOnly,
      };
    },
    res(res) {
      return {
        statusCode: res.statusCode,
      };
    },
  },
  autoLogging: {
    ignore: (req) => IGNORE_PATHS.has(req.url?.split('?')[0]),
  },
});

function resolveRoute(req) {
  if (req.route?.path) {
    const base = req.baseUrl || '';
    return `${base}${req.route.path}` || 'unknown';
  }

  const pathOnly = (req.path || req.url || '').split('?')[0];
  return pathOnly.replace(/\/\d+/g, '/:id') || 'unknown';
}

function requestMetrics(req, res, next) {
  const pathOnly = (req.url || '').split('?')[0];
  if (IGNORE_PATHS.has(pathOnly)) {
    return next();
  }

  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const route = resolveRoute(req);
    metrics.recordRequest(req.method, req.path, res.statusCode, durationMs, route);

    if (durationMs >= SLOW_REQUEST_MS) {
      logEvent.warn(
        'http.slow_request',
        {
          requestId: req.requestId,
          durationMs: Math.round(durationMs),
          method: req.method,
          path: route,
          statusCode: res.statusCode,
        },
        'Slow HTTP request'
      );
    }
  });

  return httpLogger(req, res, next);
}

module.exports = requestMetrics;
