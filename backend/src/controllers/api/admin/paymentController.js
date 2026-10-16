/**
 * Admin payment monitoring, refund queue, reconcile, and Stripe stub helpers.
 */
const { validationResult } = require('express-validator');
const paymentAdminService = require('../../../services/admin/paymentAdminService');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');
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
  try {
    const data = await paymentAdminService.listPaymentRefundQueue({
      q: req.query.q,
      status: req.query.status,
      refundState: req.query.refundState,
      pickupFrom: req.query.pickupFrom,
      pickupTo: req.query.pickupTo,
      limit: req.query.limit,
    });
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getPaymentRefundQueue',
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
  try {
    const data = await paymentAdminService.getPaymentMonitoringData();
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getPaymentMonitoring',
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
    return apiResponse.error(
      res,
      'VALIDATION_ERROR',
      errors.array()[0].msg,
      422
    );
  }

  try {
    const dryRun = req.body.dryRun === 'true' || req.body.dryRun === true;
    await paymentAdminService.runPaymentReconciliation({ dryRun });
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'admin.ran_payment_reconcile',
      entityType: 'payment',
      metadata: { dryRun },
    });
    return apiResponse.success(res, { ok: true, dryRun });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.reconcilePayments',
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
  if (!stripeTestStub.isStubEnabled()) {
    return apiResponse.error(res, 'NOT_FOUND', 'Not found.', 404);
  }

  const stripeSessionId = String(req.body?.stripeSessionId || '').trim();
  if (!stripeSessionId) {
    return apiResponse.error(res, 'VALIDATION_ERROR', 'stripeSessionId is required.', 422);
  }

  try {
    const session = stripeTestStub.markPaid(stripeSessionId);
    return apiResponse.success(res, {
      stripeSessionId: session.id,
      paymentStatus: session.payment_status,
      status: session.status,
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.markStubSessionPaid',
      publicMessage: 'Failed to mark stub session paid.',
    });
  }
});
