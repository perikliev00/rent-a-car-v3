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

router.get('/', canView, adminOrderListQueryValidationRules, validateRequest, orderController.listOrders);
router.get('/expired', canView, orderController.listExpiredOrders);
router.get('/deleted', canView, orderController.listDeletedOrders);
router.post(
  '/deleted/empty',
  canEdit,
  adminEmptyDeletedOrdersValidationRules,
  orderController.emptyDeletedOrders
);
router.get('/new', canEdit, orderController.getCreateOrderForm);
router.post('/', canEdit, adminOrderBodyValidationRules, orderController.createOrder);
router.get(
  '/:id/edit',
  canEdit,
  adminOrderIdParamValidation,
  orderController.getOrderEditForm
);
router.post(
  '/:id/restore',
  canEdit,
  adminOrderIdParamValidation,
  orderController.restoreOrder
);
router.get('/:id', canView, adminOrderIdParamValidation, orderController.getOrderById);
router.put(
  '/:id',
  canEdit,
  adminOrderIdParamValidation,
  adminOrderBodyValidationRules,
  orderController.updateOrder
);
router.delete('/:id', canCancel, adminOrderIdParamValidation, orderController.deleteOrder);

module.exports = router;
