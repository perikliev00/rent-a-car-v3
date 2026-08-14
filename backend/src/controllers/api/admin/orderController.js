const { validationResult } = require('express-validator');
const orderAdminService = require('../../../services/admin/order');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const { EMPTY_DELETED_ORDERS_CONFIRM } = require('../../../validators/adminOrderBodyValidationRules');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');

function validationErrorResponse(res, errors) {
  return apiResponse.error(
    res,
    'VALIDATION_ERROR',
    errors.array()[0].msg,
    422
  );
}

exports.listOrders = asyncHandler(async (req, res, next) => {
  try {
    const data = await orderAdminService.getOrdersList(req.query);
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.listAdminOrders',
      publicMessage: 'Error fetching orders.',
    });
  }
});

exports.listExpiredOrders = asyncHandler(async (req, res, next) => {
  try {
    const data = await orderAdminService.getExpiredOrders();
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.listExpiredOrders',
      publicMessage: 'Error fetching expired orders.',
    });
  }
});

exports.listDeletedOrders = asyncHandler(async (req, res, next) => {
  try {
    const data = await orderAdminService.getDeletedOrders();
    const retentionDays = Number(process.env.DELETED_ORDERS_RETENTION_DAYS ?? 30);
    return apiResponse.success(res, {
      ...data,
      retentionDays,
      emptyConfirmText: EMPTY_DELETED_ORDERS_CONFIRM,
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.listDeletedOrders',
      publicMessage: 'Error fetching deleted orders.',
    });
  }
});

exports.emptyDeletedOrders = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const { deletedCount } = await orderAdminService.emptyDeletedOrders();

    await logAdminAction(req, {
      action: 'admin.emptied_deleted_orders',
      entityType: 'order',
      metadata: { deletedCount },
    });

    if (deletedCount === 0) {
      return apiResponse.error(
        res,
        'CONFLICT',
        'No deleted orders met the retention threshold for permanent removal.',
        422
      );
    }

    return apiResponse.success(res, { deletedCount });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.emptyDeletedOrders',
      publicMessage: 'Error emptying deleted orders bin.',
    });
  }
});

exports.getCreateOrderForm = asyncHandler(async (req, res, next) => {
  try {
    const data = await orderAdminService.getCreateOrderForm();
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getCreateOrderForm',
      publicMessage: 'Error loading the order creation form.',
    });
  }
});

exports.getCarAvailability = asyncHandler(async (req, res, next) => {
  try {
    const result = await orderAdminService.getCarAvailability(req.params.id, req.query);

    if (result.status !== 200) {
      return apiResponse.error(
        res,
        'VALIDATION_ERROR',
        result.body.error || 'Failed to check car availability.',
        result.status
      );
    }

    return apiResponse.success(res, {
      available: result.body.available,
      conflicts: result.body.conflicts,
    });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getCarAvailability',
      publicMessage: 'Failed to check car availability.',
    });
  }
});

exports.createOrder = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const result = await orderAdminService.createOrder(req.body);

    if (result.success) {
      await logAdminAction(req, {
        action: 'admin.created_reservation',
        entityType: 'order',
        entityId: result.orderId ?? null,
        metadata: { carId: req.body.carId },
      });
      return apiResponse.success(res, { created: true, id: result.orderId ?? null }, 201);
    }

    return apiResponse.error(
      res,
      'VALIDATION_ERROR',
      result.viewModel?.error || 'Error creating order.',
      result.status || 422
    );
  } catch (err) {
    if (err.code === 'CAR_NOT_FOUND') {
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.createOrder',
      publicMessage: 'Error creating order.',
    });
  }
});

exports.getOrderById = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const order = await orderAdminService.getOrderDetails(req.params.id);
    if (!order) {
      return apiResponse.error(res, 'NOT_FOUND', 'Order not found.', 404);
    }
    return apiResponse.success(res, { order });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getOrderById',
      publicMessage: 'Error loading order details.',
    });
  }
});

exports.getOrderEditForm = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const data = await orderAdminService.getOrderEditData(req.params.id);
    if (!data) {
      return apiResponse.error(res, 'NOT_FOUND', 'Order not found.', 404);
    }
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getOrderEditForm',
      publicMessage: 'Error loading order.',
    });
  }
});

exports.updateOrder = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const result = await orderAdminService.updateOrder(req.params.id, req.body);

    if (result.success) {
      const audit = result.audit || {};
      await logAdminAction(req, {
        action: audit.moved ? 'admin.moved_reservation' : 'admin.updated_reservation',
        entityType: 'order',
        entityId: req.params.id,
        metadata: {
          carId: audit.carId,
          previousCarId: audit.previousCarId,
          from: audit.from,
          to: audit.to,
          previousFrom: audit.previousFrom,
          previousTo: audit.previousTo,
          priceChanged: audit.priceChanged,
        },
      });
      return apiResponse.success(res, { updated: true, id: Number(req.params.id) });
    }

    return apiResponse.error(
      res,
      'VALIDATION_ERROR',
      result.viewModel?.error || 'Error saving order.',
      result.status || 422
    );
  } catch (err) {
    if (err.status === 404) {
      return apiResponse.error(res, 'NOT_FOUND', 'Order not found.', 404);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.updateOrder',
      publicMessage: 'Error saving order.',
    });
  }
});

exports.deleteOrder = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    await orderAdminService.deleteOrder(req.params.id);
    await logAdminAction(req, {
      action: 'admin.cancelled_reservation',
      entityType: 'order',
      entityId: req.params.id,
    });
    return apiResponse.success(res, { deleted: true, id: Number(req.params.id) });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.deleteOrder',
      publicMessage: 'Error deleting order.',
    });
  }
});

exports.restoreOrder = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    await orderAdminService.restoreOrder(req.params.id);
    await logAdminAction(req, {
      action: 'admin.restored_reservation',
      entityType: 'order',
      entityId: req.params.id,
    });
    return apiResponse.success(res, { restored: true, id: Number(req.params.id) });
  } catch (err) {
    if (err && err.isOrderRestoreError) {
      return apiResponse.error(
        res,
        'CONFLICT',
        err.message || 'Error restoring order.',
        422
      );
    }
    return forwardControllerError(err, req, next, {
      context: 'api.restoreOrder',
      publicMessage: 'Error restoring order.',
    });
  }
});
