/**
 * Admin order lifecycle handlers (list, create, edit, soft-delete, restore, availability).
 */
const { validationResult } = require('express-validator');
// Require the '../../../services/admin/order' module as orderAdminService.
const orderAdminService = require('../../../services/admin/order');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../services/admin/adminAuditService');
// Destructure object properties into local variables.
const { EMPTY_DELETED_ORDERS_CONFIRM } = require('../../../validators/adminOrderBodyValidationRules');
// Require the '../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../utils/apiResponse');
// Require the '../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../utils/controllerError');

/**
 * Respond with 422 VALIDATION_ERROR for validation failures.
 * Side effects: writes a 422 JSON API error.
 * @param {import('express').Response} res
 * @param {import('express-validator').Result} errors
 * @returns {import('express').Response}
 */
function validationErrorResponse(res, errors) {
  // Return the resulting value to the caller.
  return apiResponse.error(
    // Contribute this line to the enclosing declaration or statement.
    res,
    // Supply the literal value used by the enclosing expression.
    'VALIDATION_ERROR',
    // Call errors.array to perform this step.
    errors.array()[0].msg,
    // Supply the literal value used by the enclosing expression.
    422
  );
}

/**
 * List admin orders with filters.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listOrders = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await orderAdminService.getOrdersList(req.query);
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.listAdminOrders',
      // Provide the public message field value.
      publicMessage: 'Error fetching orders.',
    });
  }
});

/**
 * List expired unpaid/held orders.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listExpiredOrders = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await orderAdminService.getExpiredOrders();
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.listExpiredOrders',
      // Provide the public message field value.
      publicMessage: 'Error fetching expired orders.',
    });
  }
});

/**
 * List soft-deleted orders.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.listDeletedOrders = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await orderAdminService.getDeletedOrders();
    // Create the retention days constant.
    const retentionDays = Number(process.env.DELETED_ORDERS_RETENTION_DAYS ?? 30);
    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Spread data into the surrounding structure.
      ...data,
      // Contribute this line to the enclosing declaration or statement.
      retentionDays,
      // Provide the empty confirm text field value.
      emptyConfirmText: EMPTY_DELETED_ORDERS_CONFIRM,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.listDeletedOrders',
      // Provide the public message field value.
      publicMessage: 'Error fetching deleted orders.',
    });
  }
});

/**
 * Permanently purge soft-deleted orders (when confirmed).
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.emptyDeletedOrders = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Destructure object properties into local variables.
    const { deletedCount } = await orderAdminService.emptyDeletedOrders();

    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.emptied_deleted_orders',
      // Provide the entity type field value.
      entityType: 'order',
      // Provide the metadata field value.
      metadata: { deletedCount },
    });

    // Evaluate the condition and enter the branch when it is true.
    if (deletedCount === 0) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'CONFLICT',
        // Supply the literal value used by the enclosing expression.
        'No deleted orders met the retention threshold for permanent removal.',
        // Supply the literal value used by the enclosing expression.
        422
      );
    }

    // Return the resulting value to the caller.
    return apiResponse.success(res, { deletedCount });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.emptyDeletedOrders',
      // Provide the public message field value.
      publicMessage: 'Error emptying deleted orders bin.',
    });
  }
});

/**
 * Return form metadata for creating an admin order.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getCreateOrderForm = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await orderAdminService.getCreateOrderForm();
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getCreateOrderForm',
      // Provide the public message field value.
      publicMessage: 'Error loading the order creation form.',
    });
  }
});

/**
 * Return availability windows for a car.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getCarAvailability = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await orderAdminService.getCarAvailability(req.params.id, req.query);

    // Evaluate the condition and enter the branch when it is true.
    if (result.status !== 200) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'VALIDATION_ERROR',
        // Contribute this line to the enclosing declaration or statement.
        result.body.error || 'Failed to check car availability.',
        // Contribute this line to the enclosing declaration or statement.
        result.status
      );
    }

    // Return the resulting value to the caller.
    return apiResponse.success(res, {
      // Provide the available field value.
      available: result.body.available,
      // Provide the conflicts field value.
      conflicts: result.body.conflicts,
    });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getCarAvailability',
      // Provide the public message field value.
      publicMessage: 'Failed to check car availability.',
    });
  }
});

/**
 * Create an order from the admin panel.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.createOrder = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await orderAdminService.createOrder(req.body);

    // Evaluate the condition and enter the branch when it is true.
    if (result.success) {
      // Record an admin audit entry for this mutation.
      await logAdminAction(req, {
        // Provide the action field value.
        action: 'admin.created_reservation',
        // Provide the entity type field value.
        entityType: 'order',
        // Provide the entity id field value.
        entityId: result.orderId ?? null,
        // Provide the metadata field value.
        metadata: { carId: req.body.carId },
      });
      // Return the resulting value to the caller.
      return apiResponse.success(res, { created: true, id: result.orderId ?? null }, 201);
    }

    // Return the resulting value to the caller.
    return apiResponse.error(
      // Contribute this line to the enclosing declaration or statement.
      res,
      // Supply the literal value used by the enclosing expression.
      'VALIDATION_ERROR',
      // Contribute this line to the enclosing declaration or statement.
      result.viewModel?.error || 'Error creating order.',
      // Contribute this line to the enclosing declaration or statement.
      result.status || 422
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.code === 'CAR_NOT_FOUND') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.createOrder',
      // Provide the public message field value.
      publicMessage: 'Error creating order.',
    });
  }
});

/**
 * Return an admin order by id.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getOrderById = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the order constant.
    const order = await orderAdminService.getOrderDetails(req.params.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!order) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Order not found.', 404);
    }
    // Return the resulting value to the caller.
    return apiResponse.success(res, { order });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getOrderById',
      // Provide the public message field value.
      publicMessage: 'Error loading order details.',
    });
  }
});

/**
 * Return form metadata for editing an admin order.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.getOrderEditForm = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the data constant.
    const data = await orderAdminService.getOrderEditData(req.params.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!data) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Order not found.', 404);
    }
    // Return the resulting value to the caller.
    return apiResponse.success(res, data);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getOrderEditForm',
      // Provide the public message field value.
      publicMessage: 'Error loading order.',
    });
  }
});

/**
 * Update an admin order.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.updateOrder = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the result constant.
    const result = await orderAdminService.updateOrder(req.params.id, req.body);

    // Evaluate the condition and enter the branch when it is true.
    if (result.success) {
      // Create the audit constant.
      const audit = result.audit || {};
      // Record an admin audit entry for this mutation.
      await logAdminAction(req, {
        // Provide the action field value.
        action: audit.moved ? 'admin.moved_reservation' : 'admin.updated_reservation',
        // Provide the entity type field value.
        entityType: 'order',
        // Provide the entity id field value.
        entityId: req.params.id,
        // Provide the metadata field value.
        metadata: {
          // Provide the car id field value.
          carId: audit.carId,
          // Provide the previous car id field value.
          previousCarId: audit.previousCarId,
          // Provide the from field value.
          from: audit.from,
          // Provide the to field value.
          to: audit.to,
          // Provide the previous from field value.
          previousFrom: audit.previousFrom,
          // Provide the previous to field value.
          previousTo: audit.previousTo,
          // Provide the price changed field value.
          priceChanged: audit.priceChanged,
        },
      });
      // Return the resulting value to the caller.
      return apiResponse.success(res, { updated: true, id: Number(req.params.id) });
    }

    // Return the resulting value to the caller.
    return apiResponse.error(
      // Contribute this line to the enclosing declaration or statement.
      res,
      // Supply the literal value used by the enclosing expression.
      'VALIDATION_ERROR',
      // Contribute this line to the enclosing declaration or statement.
      result.viewModel?.error || 'Error saving order.',
      // Contribute this line to the enclosing declaration or statement.
      result.status || 422
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.status === 404) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Order not found.', 404);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.updateOrder',
      // Provide the public message field value.
      publicMessage: 'Error saving order.',
    });
  }
});

/**
 * Soft-delete (cancel) an admin order.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.deleteOrder = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await orderAdminService.deleteOrder(req.params.id);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.cancelled_reservation',
      // Provide the entity type field value.
      entityType: 'order',
      // Provide the entity id field value.
      entityId: req.params.id,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { deleted: true, id: Number(req.params.id) });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.deleteOrder',
      // Provide the public message field value.
      publicMessage: 'Error deleting order.',
    });
  }
});

/**
 * Restore a soft-deleted admin order.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
exports.restoreOrder = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await orderAdminService.restoreOrder(req.params.id);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.restored_reservation',
      // Provide the entity type field value.
      entityType: 'order',
      // Provide the entity id field value.
      entityId: req.params.id,
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { restored: true, id: Number(req.params.id) });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err && err.isOrderRestoreError) {
      // Return the resulting value to the caller.
      return apiResponse.error(
        // Contribute this line to the enclosing declaration or statement.
        res,
        // Supply the literal value used by the enclosing expression.
        'CONFLICT',
        // Contribute this line to the enclosing declaration or statement.
        err.message || 'Error restoring order.',
        // Supply the literal value used by the enclosing expression.
        422
      );
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.restoreOrder',
      // Provide the public message field value.
      publicMessage: 'Error restoring order.',
    });
  }
});
