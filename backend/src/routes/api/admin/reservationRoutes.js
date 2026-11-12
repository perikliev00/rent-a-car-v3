/**
 * Admin reservation ops, checklists, status changes, and refunds.
 */
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

// Ops board: today's pickups/returns and attention items.
router.get('/ops-dashboard', canViewOps, reservationOpsController.getOpsDashboard);

// Customer cancellation requests awaiting staff review.
router.get(
  '/cancellation-requests',
  canCancelOrders,
  checklistController.listCancellationRequests
);

// Approve or reject a cancellation request.
router.post(
  '/cancellation-requests/:id/review',
  canCancelOrders,
  adminCancellationReviewValidationRules,
  validateRequest,
  checklistController.reviewCancellationRequest
);

// Reservation detail for ops drawer.
router.get('/:id', canViewOps, reservationController.getReservation);

// Pickup/return checklist history for a reservation.
router.get('/:id/checklists', canViewOps, checklistController.getChecklists);

// Submit pickup checklist with photos/signatures.
router.post(
  '/:id/pickup-checklist',
  canManageChecklists,
  ...checklistUpload,
  adminChecklistValidationRules,
  validateRequest,
  checklistController.submitPickupChecklist
);

// Submit return checklist with photos/signatures.
router.post(
  '/:id/return-checklist',
  canManageChecklists,
  ...checklistUpload,
  adminChecklistValidationRules,
  validateRequest,
  checklistController.submitReturnChecklist
);

// Download ops PDFs (checklist / contract kinds).
router.get(
  '/:id/pdf/:kind',
  canViewOps,
  adminPdfKindValidationRules,
  validateRequest,
  checklistController.downloadPdf
);

// Advance reservation status along the allowed transition graph.
router.post(
  '/:id/status',
  canChangeStatus,
  ...adminReservationStatusValidationRules,
  validateRequest,
  reservationController.changeStatus
);

// Issue a refund against the reservation's payment.
router.post('/:id/refund', canRefundPayments, reservationController.refundReservation);

module.exports = router;
