const cors = require('cors');

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3001',
  'http://127.0.0.1:3001',
];

function parseCorsOrigins(value) {
  if (!value || !String(value).trim()) {
    return [];
  }

  return String(value)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function getAllowedOrigins(config) {
  if (config.corsOrigins && config.corsOrigins.length > 0) {
    return config.corsOrigins;
  }

  if (!config.isProd) {
    return DEFAULT_DEV_ORIGINS;
  }

  return [];
}

function createCorsMiddleware(config) {
  const allowedOrigins = new Set(getAllowedOrigins(config));

  if (allowedOrigins.size === 0) {
    return null;
  }

  return cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-CSRF-Token',
      'X-Correlation-Id',
    ],
  });
}

module.exports = {
  DEFAULT_DEV_ORIGINS,
  parseCorsOrigins,
  getAllowedOrigins,
  createCorsMiddleware,
};
