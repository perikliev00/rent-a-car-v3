/**
 * Admin reservation ops, checklists, status changes, and refunds.
 */
const express = require('express');
// Require the '../../../controllers/api/admin/reservationController' module as reservationController.
const reservationController = require('../../../controllers/api/admin/reservationController');
// Require the '../../../controllers/api/admin/reservationOpsController' module as reservationOpsController.
const reservationOpsController = require('../../../controllers/api/admin/reservationOpsController');
// Require the '../../../controllers/api/admin/checklistController' module as checklistController.
const checklistController = require('../../../controllers/api/admin/checklistController');
// Destructure object properties into local variables.
const { requirePermission } = require('../../../middleware/auth');
// Require the '../../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../../middleware/validateRequest');
// Destructure object properties into local variables.
const { checklistUpload } = require('../../../middleware/privateUpload');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  adminReservationStatusValidationRules,
// Continue the surrounding logic with this statement.
} = require('../../../validators/adminReservationStatusValidationRules');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  adminChecklistValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  adminCancellationReviewValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  adminPdfKindValidationRules,
// Continue the surrounding logic with this statement.
} = require('../../../validators/adminChecklistValidationRules');

// Create the router constant.
const router = express.Router();
// Create the can view ops constant.
const canViewOps = requirePermission('can_view_reservations_ops');
// Create the can change status constant.
const canChangeStatus = requirePermission('can_change_reservation_status');
// Create the can manage checklists constant.
const canManageChecklists = requirePermission('can_manage_checklists');
// Create the can cancel orders constant.
const canCancelOrders = requirePermission('can_cancel_orders');
// Create the can refund payments constant.
const canRefundPayments = requirePermission('can_refund_payments');

// Ops board: today's pickups/returns and attention items.
router.get('/ops-dashboard', canViewOps, reservationOpsController.getOpsDashboard);

// Customer cancellation requests awaiting staff review.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/cancellation-requests',
  // Contribute this line to the enclosing declaration or statement.
  canCancelOrders,
  // Contribute this line to the enclosing declaration or statement.
  checklistController.listCancellationRequests
);

// Approve or reject a cancellation request.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/cancellation-requests/:id/review',
  // Contribute this line to the enclosing declaration or statement.
  canCancelOrders,
  // Contribute this line to the enclosing declaration or statement.
  adminCancellationReviewValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  checklistController.reviewCancellationRequest
);

// Reservation detail for ops drawer.
router.get('/:id', canViewOps, reservationController.getReservation);

// Pickup/return checklist history for a reservation.
router.get('/:id/checklists', canViewOps, checklistController.getChecklists);

// Submit pickup checklist with photos/signatures.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/pickup-checklist',
  // Contribute this line to the enclosing declaration or statement.
  canManageChecklists,
  // Spread checklistUpload into the surrounding structure.
  ...checklistUpload,
  // Contribute this line to the enclosing declaration or statement.
  adminChecklistValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  checklistController.submitPickupChecklist
);

// Submit return checklist with photos/signatures.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/return-checklist',
  // Contribute this line to the enclosing declaration or statement.
  canManageChecklists,
  // Spread checklistUpload into the surrounding structure.
  ...checklistUpload,
  // Contribute this line to the enclosing declaration or statement.
  adminChecklistValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  checklistController.submitReturnChecklist
);

// Download ops PDFs (checklist / contract kinds).
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:id/pdf/:kind',
  // Contribute this line to the enclosing declaration or statement.
  canViewOps,
  // Contribute this line to the enclosing declaration or statement.
  adminPdfKindValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  checklistController.downloadPdf
);

// Advance reservation status along the allowed transition graph.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/status',
  // Contribute this line to the enclosing declaration or statement.
  canChangeStatus,
  // Spread adminReservationStatusValidationRules into the surrounding structure.
  ...adminReservationStatusValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  validateRequest,
  // Contribute this line to the enclosing declaration or statement.
  reservationController.changeStatus
);

// Issue a refund against the reservation's payment.
router.post('/:id/refund', canRefundPayments, reservationController.refundReservation);

// Assign the CommonJS module exports.
module.exports = router;
