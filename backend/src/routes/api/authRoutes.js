/**
 * Public auth routes: login, signup, email verification, logout, CSRF, and current user.
 */
const express = require('express');
const authController = require('../../controllers/api/authController');
const { requireAuthApi } = require('../../middleware/auth');
const validateRequest = require('../../middleware/validateRequest');
const { authLoginValidationRules } = require('../../validators/authLoginValidationRules');
const {
  authSignupValidationRules,
  authVerifyEmailValidationRules,
} = require('../../validators/authSignupValidationRules');
const {
  loginLimiter,
  signupLimiter,
  emailVerificationLimiter,
} = require('../../middleware/rateLimit');
const { apiLoginAttemptGuard } = require('../../middleware/apiLoginAttemptGuard');

const router = express.Router();

// Session login; rate-limited + lockout guard before password check.
router.post(
  '/login',
  loginLimiter,
  authLoginValidationRules,
  apiLoginAttemptGuard,
  authController.postLogin
);

// Create customer account (unverified until email confirm).
router.post(
  '/signup',
  signupLimiter,
  authSignupValidationRules,
  authController.postSignup
);

// Confirm email with token from signup / resend mail.
router.post(
  '/verify-email',
  emailVerificationLimiter,
  authVerifyEmailValidationRules,
  validateRequest,
  authController.postVerifyEmail
);

// Authenticated user requests another verification email.
router.post(
  '/resend-verification',
  emailVerificationLimiter,
  requireAuthApi,
  authController.postResendVerification
);

// Destroy session cookie / store row.
router.post('/logout', authController.postLogout);
// Return CSRF token for SPA double-submit header.
router.get('/csrf', authController.getCsrf);
// Current session user payload (or anonymous).
router.get('/me', authController.getMe);

module.exports = router;
