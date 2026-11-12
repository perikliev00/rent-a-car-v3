/**
 * Admin car CRUD and fleet status change handlers.
 */
const { validationResult } = require('express-validator');
// Require the '../../../../services/admin/carAdminService' module as carAdminService.
const carAdminService = require('../../../../services/admin/carAdminService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
// Require the '../../../../utils/apiResponse' module as apiResponse.
const apiResponse = require('../../../../utils/apiResponse');
// Require the '../../../../utils/asyncHandler' module as asyncHandler.
const asyncHandler = require('../../../../utils/asyncHandler');
// Destructure object properties into local variables.
const { forwardControllerError } = require('../../../../utils/controllerError');
// Require the '../../../../utils/logger' module as logger.
const logger = require('../../../../utils/logger');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  validationErrorResponse,
  // Contribute this line to the enclosing declaration or statement.
  cleanupUploads,
  // Contribute this line to the enclosing declaration or statement.
  notFoundOrForward,
// Continue the surrounding logic with this statement.
} = require('./carControllerHelpers');

/**
 * List cars for admin fleet management.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const listCars = asyncHandler(async (req, res, next) => {
  // Start a try block for operations that may fail.
  try {
    // Create the cars constant.
    const cars = await carAdminService.listCars();
    // Return the resulting value to the caller.
    return apiResponse.success(res, { cars });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.listAdminCars',
      // Provide the public message field value.
      publicMessage: 'Error loading cars.',
    });
  }
});

/**
 * Return a single admin car by id.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const getCarById = asyncHandler(async (req, res, next) => {
  // Collect express-validator results for this request.
  const errors = validationResult(req);
  // Validation failed — respond before running domain logic.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the car constant.
    const car = await carAdminService.getCarById(req.params.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!car) {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    // Return the resulting value to the caller.
    return apiResponse.success(res, { car });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.getAdminCarById',
      // Provide the public message field value.
      publicMessage: 'Error loading car.',
    });
  }
});

/**
 * Create a car (optional image upload).
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const createCar = asyncHandler(async (req, res, _next) => {
  // Start a try block for operations that may fail.
  try {
    // Multer/content validation soft-failed earlier in the chain.
    if (req.fileValidationError) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return validationErrorResponse(res, errors);
    }

    // Create the car constant.
    const car = await carAdminService.createCar(req.body, req.file);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.created_car',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: car?.id,
      // Provide the metadata field value.
      metadata: { name: req.body.name },
    });

    // Return the resulting value to the caller.
    return apiResponse.success(res, { car }, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Drop temp uploads so failed requests leave no orphans.
    await cleanupUploads(req);
    // Call logger.error to perform this step.
    logger.error({ err, correlationId: req.correlationId, context: 'api.createAdminCar' }, 'Create car error');
    // Return the resulting value to the caller.
    return apiResponse.error(
      // Contribute this line to the enclosing declaration or statement.
      res,
      // Supply the literal value used by the enclosing expression.
      'VALIDATION_ERROR',
      // Contribute this line to the enclosing declaration or statement.
      err.message || 'Error creating car. Please check all required fields are filled.',
      // Supply the literal value used by the enclosing expression.
      422
    );
  }
});

/**
 * Update a car (optional image upload).
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const updateCar = asyncHandler(async (req, res, _next) => {
  // Start a try block for operations that may fail.
  try {
    // Multer/content validation soft-failed earlier in the chain.
    if (req.fileValidationError) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      // Return the resulting value to the caller.
      return validationErrorResponse(res, errors);
    }

    // Destructure object properties into local variables.
    const { car, audit } = await carAdminService.updateCar(req.params.id, req.body, req.file);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: audit?.priceChanged ? 'admin.updated_price' : 'admin.updated_car',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: {
        // Provide the name field value.
        name: audit?.name ?? req.body.name,
        // Call ... to perform this step.
        ...(audit?.priceChanged
          // Contribute this line to the enclosing declaration or statement.
          ? {
              // Provide the previous tiers field value.
              previousTiers: audit.previousTiers,
              // Provide the new tiers field value.
              newTiers: audit.newTiers,
            }
          // Continue the surrounding logic with this statement.
          : {}),
      },
    });

    // Return the resulting value to the caller.
    return apiResponse.success(res, { car });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Drop temp uploads so failed requests leave no orphans.
    await cleanupUploads(req);
    // Evaluate the condition and enter the branch when it is true.
    if (err.message === 'Car not found') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    // Call logger.error to perform this step.
    logger.error({ err, correlationId: req.correlationId, context: 'api.updateAdminCar' }, 'Edit car error');
    // Return the resulting value to the caller.
    return apiResponse.error(
      // Contribute this line to the enclosing declaration or statement.
      res,
      // Supply the literal value used by the enclosing expression.
      'VALIDATION_ERROR',
      // Contribute this line to the enclosing declaration or statement.
      err.message || 'Error updating car. Please check all required fields are filled.',
      // Supply the literal value used by the enclosing expression.
      422
    );
  }
});

/**
 * Delete a car by id.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const deleteCar = asyncHandler(async (req, res, next) => {
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
    await carAdminService.deleteCar(req.params.id);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.changed_car_status',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: { isDeleted: true, status: 'inactive' },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { deleted: true, id: Number(req.params.id) });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Evaluate the condition and enter the branch when it is true.
    if (err.message === 'Car not found') {
      // Return the resulting value to the caller.
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    // Return the resulting value to the caller.
    return forwardControllerError(err, req, next, {
      // Provide the context field value.
      context: 'api.deleteAdminCar',
      // Provide the public message field value.
      publicMessage: 'Error deleting car.',
    });
  }
});

/**
 * Change fleet operational status for a car.
 * Side effects: may read/write domain state via services and send an API JSON response.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const changeFleetStatus = asyncHandler(async (req, res, next) => {
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
    const result = await carAdminService.changeFleetStatus(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.body.status,
      // Contribute this line to the enclosing declaration or statement.
      req.body.reason || null
    );
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.changed_car_fleet_status',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: {
        // Provide the old status field value.
        oldStatus: result.oldStatus,
        // Provide the new status field value.
        newStatus: result.newStatus,
        // Provide the reason field value.
        reason: result.reason,
      },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, result);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return notFoundOrForward(err, req, res, next, 'api.changeCarFleetStatus', 'Error updating car status.');
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listCars,
  // Contribute this line to the enclosing declaration or statement.
  getCarById,
  // Contribute this line to the enclosing declaration or statement.
  createCar,
  // Contribute this line to the enclosing declaration or statement.
  updateCar,
  // Contribute this line to the enclosing declaration or statement.
  deleteCar,
  // Contribute this line to the enclosing declaration or statement.
  changeFleetStatus,
};
