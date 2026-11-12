/**
 * Admin payment monitoring, refund queue, and reconcile endpoints.
 */
const express = require('express');
// Require the '../../../controllers/api/admin/paymentController' module as paymentController.
const paymentController = require('../../../controllers/api/admin/paymentController');
// Destructure object properties into local variables.
const { requireAnyPermission, requirePermission } = require('../../../middleware/auth');
// Destructure object properties into local variables.
const { adminPaymentReconcileValidationRules } = require('../../../validators/adminOrderBodyValidationRules');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  adminPaymentRefundQueueValidationRules,
// Continue the surrounding logic with this statement.
} = require('../../../validators/adminPaymentRefundQueueValidationRules');
// Require the '../../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../../middleware/validateRequest');
// Require the '../../../services/payment/stripeTestStub' module as stripeTestStub.
const stripeTestStub = require('../../../services/payment/stripeTestStub');

// Create the router constant.
const router = express.Router();

// Payments awaiting refund action / review.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/refund-queue',
  // Call requirePermission to perform this step.
  requirePermission('can_refund_payments'),
  // Contribute this line to the enclosing declaration or statement.
  adminPaymentRefundQueueValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  paymentController.getPaymentRefundQueue
);
// Payment monitor table (revenue viewers or payment managers).
router.get(
  // Supply the literal value used by the enclosing expression.
  '/',
  // Call requireAnyPermission to perform this step.
  requireAnyPermission(['can_manage_payments_monitor', 'can_view_revenue']),
  // Contribute this line to the enclosing declaration or statement.
  paymentController.getPaymentMonitoring
);
// Pull Stripe state into local payment rows.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/reconcile',
  // Call requirePermission to perform this step.
  requirePermission('can_refund_payments'),
  // Contribute this line to the enclosing declaration or statement.
  adminPaymentReconcileValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  paymentController.reconcilePayments
);

// Dev/test-only stub to mark a Checkout Session paid without Stripe.
if (stripeTestStub.isStubEnabled()) {
  // Call router.post to perform this step.
  router.post(
    // Supply the literal value used by the enclosing expression.
    '/stub/mark-paid',
    // Call requirePermission to perform this step.
    requirePermission('can_refund_payments'),
    // Contribute this line to the enclosing declaration or statement.
    paymentController.markStubSessionPaid
  );
}

// Assign the CommonJS module exports.
module.exports = router;
