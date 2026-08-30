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

const getCarById = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
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

const createCar = asyncHandler(async (req, res, _next) => {
  try {
    if (req.fileValidationError) {
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await cleanupUploads(req);
      return validationErrorResponse(res, errors);
    }

    const car = await carAdminService.createCar(req.body, req.file);
    await logAdminAction(req, {
      action: 'admin.created_car',
      entityType: 'car',
      entityId: car?.id,
      metadata: { name: req.body.name },
    });

    return apiResponse.success(res, { car }, 201);
  } catch (err) {
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

const updateCar = asyncHandler(async (req, res, _next) => {
  try {
    if (req.fileValidationError) {
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      await cleanupUploads(req);
      return validationErrorResponse(res, errors);
    }

    const { car, audit } = await carAdminService.updateCar(req.params.id, req.body, req.file);
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

const deleteCar = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    await carAdminService.deleteCar(req.params.id);
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

const changeFleetStatus = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const result = await carAdminService.changeFleetStatus(
      req.params.id,
      req.body.status,
      req.body.reason || null
    );
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
