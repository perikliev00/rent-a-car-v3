const rateLimit = require('express-rate-limit');
const apiResponse = require('../utils/apiResponse');
const { TooManyRequestsError } = require('../utils/appError');
const logger = require('../utils/logger');

const READ_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

function defaultHandler(req, res) {
  const error = new TooManyRequestsError();
  return apiResponse.error(res, error.code, error.message, error.status, req);
}

function readPositiveInt(envKey, fallback) {
  const raw = process.env[envKey];
  if (raw === undefined || raw === '') {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function createPolicyHandler(policy) {
  return function handler(req, res) {
    res.setHeader('X-RateLimit-Policy', policy);
    logger.warn(
      {
        limiter: policy,
        method: req.method,
        path: req.originalUrl,
        userId: req.session?.user?.id,
      },
      'Rate limit exceeded'
    );
    return defaultHandler(req, res);
  };
}

function createLimiter(options) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: defaultHandler,
    ...options,
  });
}

function isReadMethod(req) {
  return READ_METHODS.has(String(req.method || '').toUpperCase());
}

function isAdminRealtimeStream(req) {
  const url = String(req.originalUrl || req.url || '').split('?')[0];
  return url.includes('/admin/realtime/stream');
}

function adminRateLimitKey(req) {
  if (req.session?.user?.id != null && String(req.session.user.id) !== '') {
    return `staff:${req.session.user.id}`;
  }
  if (req.sessionID) {
    return `session:${req.sessionID}`;
  }
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const ipKeyGenerator =
    typeof rateLimit.ipKeyGenerator === 'function' ? rateLimit.ipKeyGenerator : null;
  return `ip:${ipKeyGenerator ? ipKeyGenerator(ip) : ip}`;
}

const DEFAULT_WINDOW_MS = readPositiveInt('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000);

const authLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_AUTH_MAX', 10),
});

const loginLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_LOGIN_MAX', 5),
});

const signupLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_SIGNUP_MAX', 10),
});

const emailVerificationLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_EMAIL_VERIFICATION_MAX', 10),
});

const adminLimiterShared = {
  keyGenerator: adminRateLimitKey,
  // Custom staff/session keys are not IPs; skip the IPv6 keyGenerator check.
  validate: { ip: false },
};

const adminReadLimiter = createLimiter({
  ...adminLimiterShared,
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_ADMIN_READ_MAX', 1200),
  skip: (req) => !isReadMethod(req) || isAdminRealtimeStream(req),
  handler: createPolicyHandler('admin-read'),
});

const adminWriteLimiter = createLimiter({
  ...adminLimiterShared,
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_ADMIN_WRITE_MAX', 300),
  skip: (req) => isReadMethod(req),
  handler: createPolicyHandler('admin-write'),
});

const adminRealtimeLimiter = createLimiter({
  ...adminLimiterShared,
  windowMs: readPositiveInt('RATE_LIMIT_ADMIN_REALTIME_WINDOW_MS', 60 * 1000),
  max: readPositiveInt('RATE_LIMIT_ADMIN_REALTIME_MAX', 30),
  skip: (req) => !isAdminRealtimeStream(req),
  handler: createPolicyHandler('admin-realtime'),
});

const adminUploadLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_ADMIN_UPLOAD_MAX', 20),
});

const checkoutLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_CHECKOUT_MAX', 20),
});

const bookingLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_BOOKING_MAX', 30),
});

const chatLimiter = createLimiter({
  windowMs: readPositiveInt('RATE_LIMIT_CHAT_WINDOW_MS', 60 * 1000),
  max: readPositiveInt('RATE_LIMIT_CHAT_MAX', 60),
});

const contactLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_CONTACT_MAX', 10),
});

const accountUploadLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_ACCOUNT_UPLOAD_MAX', 20),
});

module.exports = {
  authLimiter,
  loginLimiter,
  signupLimiter,
  emailVerificationLimiter,
  adminReadLimiter,
  adminWriteLimiter,
  adminRealtimeLimiter,
  accountUploadLimiter,
  adminUploadLimiter,
  checkoutLimiter,
  bookingLimiter,
  chatLimiter,
  contactLimiter,
  createLimiter,
  defaultHandler,
  adminRateLimitKey,
  isAdminRealtimeStream,
  isReadMethod,
};
