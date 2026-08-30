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

router.post(
  '/login',
  loginLimiter,
  authLoginValidationRules,
  apiLoginAttemptGuard,
  authController.postLogin
);

router.post(
  '/signup',
  signupLimiter,
  authSignupValidationRules,
  authController.postSignup
);

router.post(
  '/verify-email',
  emailVerificationLimiter,
  authVerifyEmailValidationRules,
  validateRequest,
  authController.postVerifyEmail
);

router.post(
  '/resend-verification',
  emailVerificationLimiter,
  requireAuthApi,
  authController.postResendVerification
);

router.post('/logout', authController.postLogout);
router.get('/csrf', authController.getCsrf);
router.get('/me', authController.getMe);

module.exports = router;
