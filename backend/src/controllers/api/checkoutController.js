/**
 * Stripe Checkout session create, success, and cancel handlers.
 */
const { validationResult } = require('express-validator');
// Destructure object properties into local variables.
const { createCheckoutSessionFlow } = require('../../services/payment/checkout/checkoutSessionService');
// Destructure object properties into local variables.
const { handleCheckoutSuccessFlow } = require('../../services/payment/successService');
// Destructure object properties into local variables.
const { releaseActiveReservationForSession } = require('../../services/reservationService');
// Require the '../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../utils/apiResponse');
// Require the '../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../utils/controllerError');
// Require the '../../utils/logger' module as logger.
const logger = require('../../utils/logger');

/**
 * Create a Stripe Checkout session for the current booking hold.
 * Side effects: may create Stripe session + local payment rows via the checkout flow.
 * @param {import('express').Request} req - Validated order/checkout body
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.createCheckoutSession = asyncHandler(async (req, res, next) => {
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return apiResponse.error(
      // Contribute this line to the enclosing declaration or statement.
      res,
      // Supply the literal value used by the enclosing expression.
      'VALIDATION_ERROR',
      // Call errors.array to perform this step.
      errors.array()[0].msg,
      // Supply the literal value used by the enclosing expression.
      422
    );
  }

  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await createCheckoutSessionFlow(req);

    // Domain error rendered as order-page message in the old SSR flow; API returns 422.
    if (result.type === 'renderOrderPage') {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'CHECKOUT_ERROR',
        // Contribute this line to the enclosing declaration or statement.
        result.message || 'Unable to start checkout.',
        // Supply the literal value used by the enclosing expression.
        422
      );
    }

    // Evaluate the condition and enter the branch when it is true.
    if (result.type === 'redirect') {
      // Return the resulting value to the caller.
      return apiResponse.success(res, { checkoutUrl: result.url });
    }

    // Throw an error to stop the current control flow.
    throw new Error('Unexpected checkout session flow result.');
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.createCheckoutSession',
      // Provide the public message field value.
      publicMessage: 'Error creating checkout session.',
    });
  }
});

/**
 * Handle post-checkout success redirect/query confirmation.
 * Side effects: may mark payment/order paid if webhook has not already done so.
 * @param {import('express').Request} req - Validated success query (session_id, etc.)
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.handleCheckoutSuccess = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await handleCheckoutSuccessFlow(req);
    // Return the resulting value to the caller.
    return apiResponse.success(res, result);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.handleCheckoutSuccess',
      // Provide the public message field value.
      publicMessage: 'Error confirming checkout.',
    });
  }
});

/**
 * Handle checkout cancellation and release related hold state.
 * Side effects: best-effort release of the session's active reservation hold.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.handleCheckoutCancel = asyncHandler(async (req, res, next) => {
  // Initialize the mutable cancelled variable.
  let cancelled = false;
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await releaseActiveReservationForSession(req, { reason: 'checkout_cancel' });
    // Update cancelled with the right-hand side value.
    cancelled = Boolean(result?.cancelled);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Still return a friendly success body; release failures are logged only.
    logger.warn(
      // Contribute this line to the enclosing declaration or statement.
      { err, correlationId: req.correlationId, context: 'api.handleCheckoutCancel' },
      // Supply the literal value used by the enclosing expression.
      'Cancel handler error'
    );
  }

  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Contribute this line to the enclosing declaration or statement.
      cancelled,
      // Provide the message field value.
      message: cancelled
        // Continue the surrounding logic with this statement.
        ? 'Your payment was cancelled and your reservation hold has been released. You can start a new booking when ready.'
        // Continue the surrounding logic with this statement.
        : 'No active reservation hold to cancel. You can start a new search whenever you are ready.',
      // Provide the support email field value.
      supportEmail: process.env.SUPPORT_EMAIL || 'support@rentacar.com',
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.handleCheckoutCancel',
      // Provide the public message field value.
      publicMessage: 'Error handling checkout cancellation.',
    });
  }
});
