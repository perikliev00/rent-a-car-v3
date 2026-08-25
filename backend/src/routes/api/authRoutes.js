const express = require('express');
const authController = require('../../controllers/api/authController');
const { authLoginValidationRules } = require('../../validators/authLoginValidationRules');
const { authSignupValidationRules } = require('../../validators/authSignupValidationRules');
const {
  authVerifyEmailValidationRules,
} = require('../../validators/authVerificationValidationRules');
const {
  loginLimiter,
  signupLimiter,
  verificationLimiter,
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
  verificationLimiter,
  authVerifyEmailValidationRules,
  authController.postVerifyEmail
);

router.post(
  '/verify-email/resend',
  verificationLimiter,
  authController.postResendVerification
);

router.post('/logout', authController.postLogout);
router.get('/csrf', authController.getCsrf);
router.get('/me', authController.getMe);

module.exports = router;
