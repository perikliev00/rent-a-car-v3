// Define the passthrough function.
function passthrough(_req, _res, next) {
  // Call next to perform this step.
  next();
}

// Assign the CommonJS module exports.
module.exports = {
  // Provide the auth limiter field value.
  authLimiter: passthrough,
  // Provide the login limiter field value.
  loginLimiter: passthrough,
  // Provide the signup limiter field value.
  signupLimiter: passthrough,
  // Provide the email verification limiter field value.
  emailVerificationLimiter: passthrough,
  // Provide the admin read limiter field value.
  adminReadLimiter: passthrough,
  // Provide the admin write limiter field value.
  adminWriteLimiter: passthrough,
  // Provide the admin realtime limiter field value.
  adminRealtimeLimiter: passthrough,
  // Provide the admin upload limiter field value.
  adminUploadLimiter: passthrough,
  // Provide the account upload limiter field value.
  accountUploadLimiter: passthrough,
  // Provide the checkout limiter field value.
  checkoutLimiter: passthrough,
  // Provide the booking limiter field value.
  bookingLimiter: passthrough,
  // Provide the chat limiter field value.
  chatLimiter: passthrough,
  // Provide the search limiter field value.
  searchLimiter: passthrough,
  // Provide the contact limiter field value.
  contactLimiter: passthrough,
  // Provide the create limiter field value.
  createLimiter: () => passthrough,
  // Provide the default handler field value.
  defaultHandler: passthrough,
  // Provide the admin rate limit key field value.
  adminRateLimitKey: () => 'test',
  // Provide the is admin realtime stream field value.
  isAdminRealtimeStream: () => false,
  // Provide the is read method field value.
  isReadMethod: () => false,
};
