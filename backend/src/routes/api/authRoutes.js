const express = require('express');
const authController = require('../../controllers/api/authController');
const { authLoginValidationRules } = require('../../validators/authLoginValidationRules');
const { authSignupValidationRules } = require('../../validators/authSignupValidationRules');
const { loginLimiter, signupLimiter } = require('../../middleware/rateLimit');
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

router.post('/logout', authController.postLogout);
router.get('/csrf', authController.getCsrf);
router.get('/me', authController.getMe);

module.exports = router;
