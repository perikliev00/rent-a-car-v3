/**
 * Public auth routes: login, signup, email verification, logout, CSRF, and current user.
 */
const express = require('express');
// Require the '../../controllers/api/authController' module as authController.
const authController = require('../../controllers/api/authController');
// Destructure object properties into local variables.
const { requireAuthApi } = require('../../middleware/auth');
// Require the '../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../middleware/validateRequest');
// Destructure object properties into local variables.
const { authLoginValidationRules } = require('../../validators/authLoginValidationRules');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  authSignupValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  authVerifyEmailValidationRules,
// Continue the surrounding logic with this statement.
} = require('../../validators/authSignupValidationRules');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  loginLimiter,
  // Contribute this line to the enclosing declaration or statement.
  signupLimiter,
  // Contribute this line to the enclosing declaration or statement.
  emailVerificationLimiter,
// Continue the surrounding logic with this statement.
} = require('../../middleware/rateLimit');
// Destructure object properties into local variables.
const { apiLoginAttemptGuard } = require('../../middleware/apiLoginAttemptGuard');

// Create the router constant.
const router = express.Router();

// Session login; rate-limited + lockout guard before password check.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/login',
  // Contribute this line to the enclosing declaration or statement.
  loginLimiter,
  // Contribute this line to the enclosing declaration or statement.
  authLoginValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  apiLoginAttemptGuard,
  // Contribute this line to the enclosing declaration or statement.
  authController.postLogin
);

// Create customer account (unverified until email confirm).
router.post(
  // Supply the literal value used by the enclosing expression.
  '/signup',
  // Contribute this line to the enclosing declaration or statement.
  signupLimiter,
  // Contribute this line to the enclosing declaration or statement.
  authSignupValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  authController.postSignup
);

// Confirm email with token from signup / resend mail.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/verify-email',
  // Contribute this line to the enclosing declaration or statement.
  emailVerificationLimiter,
  // Contribute this line to the enclosing declaration or statement.
  authVerifyEmailValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  authController.postVerifyEmail
);

// Authenticated user requests another verification email.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/resend-verification',
  // Contribute this line to the enclosing declaration or statement.
  emailVerificationLimiter,
  // Contribute this line to the enclosing declaration or statement.
  requireAuthApi,
  // Contribute this line to the enclosing declaration or statement.
  authController.postResendVerification
);

// Destroy session cookie / store row.
router.post('/logout', authController.postLogout);
// Return CSRF token for SPA double-submit header.
router.get('/csrf', authController.getCsrf);
// Current session user payload (or anonymous).
router.get('/me', authController.getMe);

// Assign the CommonJS module exports.
module.exports = router;
