const express = require('express');
const reservationController = require('../../../controllers/api/admin/reservationController');
const reservationOpsController = require('../../../controllers/api/admin/reservationOpsController');
const checklistController = require('../../../controllers/api/admin/checklistController');
const { requirePermission } = require('../../../middleware/auth');
const validateRequest = require('../../../middleware/validateRequest');
const { checklistUpload } = require('../../../middleware/privateUpload');
const {
  adminReservationStatusValidationRules,
} = require('../../../validators/adminReservationStatusValidationRules');
const {
  adminChecklistValidationRules,
  adminCancellationReviewValidationRules,
  adminPdfKindValidationRules,
} = require('../../../validators/adminChecklistValidationRules');

const router = express.Router();
const canViewOps = requirePermission('can_view_reservations_ops');
const canChangeStatus = requirePermission('can_change_reservation_status');
const canManageChecklists = requirePermission('can_manage_checklists');
const canCancelOrders = requirePermission('can_cancel_orders');
const canRefundPayments = requirePermission('can_refund_payments');

router.get('/ops-dashboard', canViewOps, reservationOpsController.getOpsDashboard);

router.get(
  '/cancellation-requests',
  canCancelOrders,
  checklistController.listCancellationRequests
);

router.post(
  '/cancellation-requests/:id/review',
  canCancelOrders,
  adminCancellationReviewValidationRules,
  validateRequest,
  checklistController.reviewCancellationRequest
);

router.get('/:id', canViewOps, reservationController.getReservation);

router.get('/:id/checklists', canViewOps, checklistController.getChecklists);

router.post(
  '/:id/pickup-checklist',
  canManageChecklists,
  ...checklistUpload,
  adminChecklistValidationRules,
  validateRequest,
  checklistController.submitPickupChecklist
);

router.post(
  '/:id/return-checklist',
  canManageChecklists,
  ...checklistUpload,
  adminChecklistValidationRules,
  validateRequest,
  checklistController.submitReturnChecklist
);

router.get(
  '/:id/pdf/:kind',
  canViewOps,
  adminPdfKindValidationRules,
  validateRequest,
  checklistController.downloadPdf
);

router.post(
  '/:id/status',
  canChangeStatus,
  ...adminReservationStatusValidationRules,
  validateRequest,
  reservationController.changeStatus
);

router.post('/:id/refund', canRefundPayments, reservationController.refundReservation);

module.exports = router;
