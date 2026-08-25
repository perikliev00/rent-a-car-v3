const rateLimit = require('express-rate-limit');
const apiResponse = require('../utils/apiResponse');
const { TooManyRequestsError } = require('../utils/appError');

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

function createLimiter(options) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    handler: defaultHandler,
    ...options,
  });
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

const adminLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_ADMIN_MAX', 100),
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

// Guards email-verification token submission and resend against brute force and mail
// flooding.
const verificationLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_VERIFICATION_MAX', 10),
});

// Guards booking claim token submission against enumeration.
const claimLimiter = createLimiter({
  windowMs: DEFAULT_WINDOW_MS,
  max: readPositiveInt('RATE_LIMIT_CLAIM_MAX', 10),
});

module.exports = {
  authLimiter,
  loginLimiter,
  signupLimiter,
  verificationLimiter,
  claimLimiter,
  adminLimiter,
  accountUploadLimiter,
  adminUploadLimiter,
  checkoutLimiter,
  bookingLimiter,
  chatLimiter,
  contactLimiter,
  createLimiter,
  defaultHandler,
};
