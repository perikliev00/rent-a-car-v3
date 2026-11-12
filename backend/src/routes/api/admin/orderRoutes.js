/**
 * Admin order lifecycle routes (list, create, edit, soft-delete, restore).
 */
const express = require('express');
const orderController = require('../../../controllers/api/admin/orderController');
const { requirePermission } = require('../../../middleware/auth');
const validateRequest = require('../../../middleware/validateRequest');
const { adminOrderIdParamValidation } = require('../../../validators/adminOrderIdParamValidation');
const { adminOrderListQueryValidationRules } = require('../../../validators/adminOrderListQueryValidationRules');
const {
  adminOrderBodyValidationRules,
  adminEmptyDeletedOrdersValidationRules,
} = require('../../../validators/adminOrderBodyValidationRules');

const router = express.Router();
const canView = requirePermission('can_view_orders');
const canEdit = requirePermission('can_edit_orders');
const canCancel = requirePermission('can_cancel_orders');

// Filterable order list.
router.get('/', canView, adminOrderListQueryValidationRules, validateRequest, orderController.listOrders);
// Orders whose unpaid holds have expired.
router.get('/expired', canView, orderController.listExpiredOrders);
// Soft-deleted orders recycle bin.
router.get('/deleted', canView, orderController.listDeletedOrders);
// Permanently purge soft-deleted orders (confirmation body).
router.post(
  '/deleted/empty',
  canEdit,
  adminEmptyDeletedOrdersValidationRules,
  orderController.emptyDeletedOrders
);
// Form metadata for admin create-order UI (cars, locations, etc.).
router.get('/new', canEdit, orderController.getCreateOrderForm);
// Staff-created walk-in / phone order.
router.post('/', canEdit, adminOrderBodyValidationRules, orderController.createOrder);
// Form metadata + current values for edit UI.
router.get(
  '/:id/edit',
  canEdit,
  adminOrderIdParamValidation,
  orderController.getOrderEditForm
);
// Restore a soft-deleted order.
router.post(
  '/:id/restore',
  canEdit,
  adminOrderIdParamValidation,
  orderController.restoreOrder
);
// Order detail.
router.get('/:id', canView, adminOrderIdParamValidation, orderController.getOrderById);
// Update order fields / dates / car.
router.put(
  '/:id',
  canEdit,
  adminOrderIdParamValidation,
  adminOrderBodyValidationRules,
  orderController.updateOrder
);
// Soft-delete (cancel) an order.
router.delete('/:id', canCancel, adminOrderIdParamValidation, orderController.deleteOrder);

module.exports = router;
