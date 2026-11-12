/**
 * Admin payment monitoring, refund queue, and reconcile endpoints.
 */
const express = require('express');
const paymentController = require('../../../controllers/api/admin/paymentController');
const { requireAnyPermission, requirePermission } = require('../../../middleware/auth');
const { adminPaymentReconcileValidationRules } = require('../../../validators/adminOrderBodyValidationRules');
const {
  adminPaymentRefundQueueValidationRules,
} = require('../../../validators/adminPaymentRefundQueueValidationRules');
const validateRequest = require('../../../middleware/validateRequest');
const stripeTestStub = require('../../../services/payment/stripeTestStub');

const router = express.Router();

// Payments awaiting refund action / review.
router.get(
  '/refund-queue',
  requirePermission('can_refund_payments'),
  adminPaymentRefundQueueValidationRules,
  validateRequest,
  paymentController.getPaymentRefundQueue
);
// Payment monitor table (revenue viewers or payment managers).
router.get(
  '/',
  requireAnyPermission(['can_manage_payments_monitor', 'can_view_revenue']),
  paymentController.getPaymentMonitoring
);
// Pull Stripe state into local payment rows.
router.post(
  '/reconcile',
  requirePermission('can_refund_payments'),
  adminPaymentReconcileValidationRules,
  paymentController.reconcilePayments
);

// Dev/test-only stub to mark a Checkout Session paid without Stripe.
if (stripeTestStub.isStubEnabled()) {
  router.post(
    '/stub/mark-paid',
    requirePermission('can_refund_payments'),
    paymentController.markStubSessionPaid
  );
}

module.exports = router;
