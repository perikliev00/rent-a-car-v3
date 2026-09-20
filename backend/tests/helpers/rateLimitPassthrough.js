function passthrough(_req, _res, next) {
  next();
}

module.exports = {
  authLimiter: passthrough,
  loginLimiter: passthrough,
  signupLimiter: passthrough,
  emailVerificationLimiter: passthrough,
  adminReadLimiter: passthrough,
  adminWriteLimiter: passthrough,
  adminRealtimeLimiter: passthrough,
  adminUploadLimiter: passthrough,
  accountUploadLimiter: passthrough,
  checkoutLimiter: passthrough,
  bookingLimiter: passthrough,
  chatLimiter: passthrough,
  contactLimiter: passthrough,
  createLimiter: () => passthrough,
  defaultHandler: passthrough,
  adminRateLimitKey: () => 'test',
  isAdminRealtimeStream: () => false,
  isReadMethod: () => false,
};
