const { validationResult } = require('express-validator');
const paymentAdminService = require('../../../services/admin/paymentAdminService');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');
const stripeTestStub = require('../../../services/payment/stripeTestStub');

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

exports.reconcilePayments = asyncHandler(async (req, res, next) => {
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
    const dryRun = req.body.dryRun === 'true' || req.body.dryRun === true;
    await paymentAdminService.runPaymentReconciliation({ dryRun });
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
