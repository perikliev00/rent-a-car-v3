/**
 * Admin payment monitoring, refund queue, reconcile, and Stripe stub helpers.
 */
const { validationResult } = require('express-validator');
// Require the '../../../services/admin/paymentAdminService' module as paymentAdminService.
const paymentAdminService = require('../../../services/admin/paymentAdminService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../services/admin/adminAuditService');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../utils/controllerError');
// Require the '../../../services/payment/stripeTestStub' module as stripeTestStub.
const stripeTestStub = require('../../../services/payment/stripeTestStub');

/**
 * Return the payment refund queue.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getPaymentRefundQueue = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await paymentAdminService.listPaymentRefundQueue({
      // Provide the q field value.
      q: req.query.q,
      // Provide the status field value.
      status: req.query.status,
      // Provide the refund state field value.
      refundState: req.query.refundState,
      // Provide the pickup from field value.
      pickupFrom: req.query.pickupFrom,
      // Provide the pickup to field value.
      pickupTo: req.query.pickupTo,
      // Provide the limit field value.
      limit: req.query.limit,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getPaymentRefundQueue',
      // Provide the public message field value.
      publicMessage: 'Error loading payment refund queue.',
    });
  }
});

/**
 * Return payment monitoring summary.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getPaymentMonitoring = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await paymentAdminService.getPaymentMonitoringData();
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getPaymentMonitoring',
      // Provide the public message field value.
      publicMessage: 'Error loading payment monitoring data.',
    });
  }
});

/**
 * Reconcile payments against Stripe / local records.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.reconcilePayments = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
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
    // Create the dry run constant.
    const dryRun = req.body.dryRun === 'true' || req.body.dryRun === true;
    // Wait until the asynchronous operation resolves.
    await paymentAdminService.runPaymentReconciliation({ dryRun });
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.ran_payment_reconcile',
      // Provide the entity type field value.
      entityType: 'payment',
      // Provide the metadata field value.
      metadata: { dryRun },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { ok: true, dryRun });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.reconcilePayments',
      // Provide the public message field value.
      publicMessage: 'Payment reconciliation failed.',
    });
  }
});

/** STRIPE_STUB-only: mark a checkout session paid without finalizing (for reconcile e2e). */
/**
 * Test-only: mark a stub Stripe session as paid.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.markStubSessionPaid = asyncHandler(async (req, res, next) => {
  // Evaluate the condition and enter the branch when it is true.
  if (!stripeTestStub.isStubEnabled()) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'NOT_FOUND', 'Not found.', 404);
  }

  // Create the stripe session id constant.
  const stripeSessionId = String(req.body?.stripeSessionId || '').trim();
  // Evaluate the condition and enter the branch when it is true.
  if (!stripeSessionId) {
    // Return the resulting value to the caller.
    return apiResponse.error(res, 'VALIDATION_ERROR', 'stripeSessionId is required.', 422);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the session constant.
    const session = stripeTestStub.markPaid(stripeSessionId);
    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the stripe session id field value.
      stripeSessionId: session.id,
      // Provide the payment status field value.
      paymentStatus: session.payment_status,
      // Provide the status field value.
      status: session.status,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.markStubSessionPaid',
      // Provide the public message field value.
      publicMessage: 'Failed to mark stub session paid.',
    });
  }
});
