/**
 * Admin order lifecycle routes (list, create, edit, soft-delete, restore).
 */
const express = require('express');
// Require the '../../../controllers/api/admin/orderController' module as orderController.
const orderController = require('../../../controllers/api/admin/orderController');
// Destructure object properties into local variables.
const { requirePermission } = require('../../../middleware/auth');
// Require the '../../../middleware/validateRequest' module as validateRequest.
const validateRequest = require('../../../middleware/validateRequest');
// Destructure object properties into local variables.
const { adminOrderIdParamValidation } = require('../../../validators/adminOrderIdParamValidation');
// Destructure object properties into local variables.
const { adminOrderListQueryValidationRules } = require('../../../validators/adminOrderListQueryValidationRules');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  adminOrderBodyValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  adminEmptyDeletedOrdersValidationRules,
// Continue the surrounding logic with this statement.
} = require('../../../validators/adminOrderBodyValidationRules');

// Create the router constant.
const router = express.Router();
// Create the can view constant.
const canView = requirePermission('can_view_orders');
// Create the can edit constant.
const canEdit = requirePermission('can_edit_orders');
// Create the can cancel constant.
const canCancel = requirePermission('can_cancel_orders');

// Filterable order list.
router.get('/', canView, adminOrderListQueryValidationRules, validateRequest, orderController.listOrders);
// Orders whose unpaid holds have expired.
router.get('/expired', canView, orderController.listExpiredOrders);
// Soft-deleted orders recycle bin.
router.get('/deleted', canView, orderController.listDeletedOrders);
// Permanently purge soft-deleted orders (confirmation body).
router.post(
  // Supply the literal value used by the enclosing expression.
  '/deleted/empty',
  // Contribute this line to the enclosing declaration or statement.
  canEdit,
  // Contribute this line to the enclosing declaration or statement.
  adminEmptyDeletedOrdersValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  orderController.emptyDeletedOrders
);
// Form metadata for admin create-order UI (cars, locations, etc.).
router.get('/new', canEdit, orderController.getCreateOrderForm);
// Staff-created walk-in / phone order.
router.post('/', canEdit, adminOrderBodyValidationRules, orderController.createOrder);
// Form metadata + current values for edit UI.
router.get(
  // Supply the literal value used by the enclosing expression.
  '/:id/edit',
  // Contribute this line to the enclosing declaration or statement.
  canEdit,
  // Contribute this line to the enclosing declaration or statement.
  adminOrderIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  orderController.getOrderEditForm
);
// Restore a soft-deleted order.
router.post(
  // Supply the literal value used by the enclosing expression.
  '/:id/restore',
  // Contribute this line to the enclosing declaration or statement.
  canEdit,
  // Contribute this line to the enclosing declaration or statement.
  adminOrderIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  orderController.restoreOrder
);
// Order detail.
router.get('/:id', canView, adminOrderIdParamValidation, orderController.getOrderById);
// Update order fields / dates / car.
router.put(
  // Supply the literal value used by the enclosing expression.
  '/:id',
  // Contribute this line to the enclosing declaration or statement.
  canEdit,
  // Contribute this line to the enclosing declaration or statement.
  adminOrderIdParamValidation,
  // Contribute this line to the enclosing declaration or statement.
  adminOrderBodyValidationRules,
  // Contribute this line to the enclosing declaration or statement.
  orderController.updateOrder
);
// Soft-delete (cancel) an order.
router.delete('/:id', canCancel, adminOrderIdParamValidation, orderController.deleteOrder);

// Assign the CommonJS module exports.
module.exports = router;
