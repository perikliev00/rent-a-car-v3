/**
 * Admin car CRUD and fleet status change handlers.
 */
const { validationResult } = require('express-validator');
const carAdminService = require('../../../../services/admin/carAdminService');
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
const apiResponse = require('../../../../utils/apiResponse');
const asyncHandler = require('../../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../../utils/controllerError');
const logger = require('../../../../utils/logger');
const {
  validationErrorResponse,
  cleanupUploads,
  notFoundOrForward,
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
  try {
    const cars = await carAdminService.listCars();
    return apiResponse.success(res, { cars });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.listAdminCars',
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
    return validationErrorResponse(res, errors);
  }

  try {
    const car = await carAdminService.getCarById(req.params.id);
    if (!car) {
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    return apiResponse.success(res, { car });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getAdminCarById',
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
  try {
    // Multer/content validation soft-failed earlier in the chain.
    if (req.fileValidationError) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      return validationErrorResponse(res, errors);
    }

    const car = await carAdminService.createCar(req.body, req.file);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'admin.created_car',
      entityType: 'car',
      entityId: car?.id,
      metadata: { name: req.body.name },
    });

    return apiResponse.success(res, { car }, 201);
  } catch (err) {
    // Drop temp uploads so failed requests leave no orphans.
    await cleanupUploads(req);
    logger.error({ err, correlationId: req.correlationId, context: 'api.createAdminCar' }, 'Create car error');
    return apiResponse.error(
      res,
      'VALIDATION_ERROR',
      err.message || 'Error creating car. Please check all required fields are filled.',
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
  try {
    // Multer/content validation soft-failed earlier in the chain.
    if (req.fileValidationError) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    // Collect express-validator results for this request.
    const errors = validationResult(req);
    // Validation failed — respond before running domain logic.
    if (!errors.isEmpty()) {
      // Drop temp uploads so failed requests leave no orphans.
      await cleanupUploads(req);
      return validationErrorResponse(res, errors);
    }

    const { car, audit } = await carAdminService.updateCar(req.params.id, req.body, req.file);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: audit?.priceChanged ? 'admin.updated_price' : 'admin.updated_car',
      entityType: 'car',
      entityId: req.params.id,
      metadata: {
        name: audit?.name ?? req.body.name,
        ...(audit?.priceChanged
          ? {
              previousTiers: audit.previousTiers,
              newTiers: audit.newTiers,
            }
          : {}),
      },
    });

    return apiResponse.success(res, { car });
  } catch (err) {
    // Drop temp uploads so failed requests leave no orphans.
    await cleanupUploads(req);
    if (err.message === 'Car not found') {
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    logger.error({ err, correlationId: req.correlationId, context: 'api.updateAdminCar' }, 'Edit car error');
    return apiResponse.error(
      res,
      'VALIDATION_ERROR',
      err.message || 'Error updating car. Please check all required fields are filled.',
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
    return validationErrorResponse(res, errors);
  }

  try {
    await carAdminService.deleteCar(req.params.id);
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'admin.changed_car_status',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { isDeleted: true, status: 'inactive' },
    });
    return apiResponse.success(res, { deleted: true, id: Number(req.params.id) });
  } catch (err) {
    if (err.message === 'Car not found') {
      return apiResponse.error(res, 'NOT_FOUND', 'Car not found.', 404);
    }
    return forwardControllerError(err, req, next, {
      context: 'api.deleteAdminCar',
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
    return validationErrorResponse(res, errors);
  }

  try {
    const result = await carAdminService.changeFleetStatus(
      req.params.id,
      req.body.status,
      req.body.reason || null
    );
    // Record an admin audit entry for this mutation.
    await logAdminAction(req, {
      action: 'admin.changed_car_fleet_status',
      entityType: 'car',
      entityId: req.params.id,
      metadata: {
        oldStatus: result.oldStatus,
        newStatus: result.newStatus,
        reason: result.reason,
      },
    });
    return apiResponse.success(res, result);
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.changeCarFleetStatus', 'Error updating car status.');
  }
});

module.exports = {
  listCars,
  getCarById,
  createCar,
  updateCar,
  deleteCar,
  changeFleetStatus,
};
