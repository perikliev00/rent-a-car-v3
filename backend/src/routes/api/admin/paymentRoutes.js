const express = require('express');
const paymentController = require('../../../controllers/api/admin/paymentController');
const { requireAnyPermission, requirePermission } = require('../../../middleware/auth');
const { adminPaymentReconcileValidationRules } = require('../../../validators/adminOrderBodyValidationRules');
const stripeTestStub = require('../../../services/payment/stripeTestStub');

const router = express.Router();

router.get(
  '/',
  requireAnyPermission(['can_manage_payments_monitor', 'can_view_revenue']),
  paymentController.getPaymentMonitoring
);
router.post(
  '/reconcile',
  requirePermission('can_refund_payments'),
  adminPaymentReconcileValidationRules,
  paymentController.reconcilePayments
);

if (stripeTestStub.isStubEnabled()) {
  router.post(
    '/stub/mark-paid',
    requirePermission('can_refund_payments'),
    paymentController.markStubSessionPaid
  );
}

module.exports = router;
