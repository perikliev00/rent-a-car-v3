/**
 * Stripe Checkout session create, success, and cancel handlers.
 */
const { validationResult } = require('express-validator');
const { createCheckoutSessionFlow } = require('../../services/payment/checkout/checkoutSessionService');
const { handleCheckoutSuccessFlow } = require('../../services/payment/successService');
const { releaseActiveReservationForSession } = require('../../services/reservationService');
const apiResponse = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { forwardControllerError } = require('../../utils/controllerError');
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
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return apiResponse.error(
      res,
      'VALIDATION_ERROR',
      errors.array()[0].msg,
      422
    );
  }

  try {
    const result = await createCheckoutSessionFlow(req);

    // Domain error rendered as order-page message in the old SSR flow; API returns 422.
    if (result.type === 'renderOrderPage') {
      return apiResponse.error(
        res,
        'CHECKOUT_ERROR',
        result.message || 'Unable to start checkout.',
        422
      );
    }

    if (result.type === 'redirect') {
      return apiResponse.success(res, { checkoutUrl: result.url });
    }

    throw new Error('Unexpected checkout session flow result.');
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.createCheckoutSession',
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
  try {
    const result = await handleCheckoutSuccessFlow(req);
    return apiResponse.success(res, result);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.handleCheckoutSuccess',
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
  let cancelled = false;
  try {
    const result = await releaseActiveReservationForSession(req, { reason: 'checkout_cancel' });
    cancelled = Boolean(result?.cancelled);
  } catch (err) {
    // Still return a friendly success body; release failures are logged only.
    logger.warn(
      { err, correlationId: req.correlationId, context: 'api.handleCheckoutCancel' },
      'Cancel handler error'
    );
  }

  try {
    return apiResponse.success(res, {
      cancelled,
      message: cancelled
        ? 'Your payment was cancelled and your reservation hold has been released. You can start a new booking when ready.'
        : 'No active reservation hold to cancel. You can start a new search whenever you are ready.',
      supportEmail: process.env.SUPPORT_EMAIL || 'support@rentacar.com',
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.handleCheckoutCancel',
      publicMessage: 'Error handling checkout cancellation.',
    });
  }
});
