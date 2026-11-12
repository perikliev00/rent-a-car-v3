/**
 * Admin car service-record list/create/update/delete handlers.
 */
const { validationResult } = require('express-validator');
const carAdminService = require('../../../../services/admin/carAdminService');
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
const apiResponse = require('../../../../utils/apiResponse');
const asyncHandler = require('../../../../utils/asyncHandler');
const {
  validationErrorResponse,
  notFoundOrForward,
} = require('./carControllerHelpers');

/**
 * List service records for a car.
 * Side effects: none beyond DB reads.
 * @param {import('express').Request} req - Params: id (car id)
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const listServiceRecords = asyncHandler(async (req, res, next) => {
  try {
    const records = await carAdminService.listServiceRecords(req.params.id);
    return apiResponse.success(res, { records });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarServiceRecords', 'Error loading service records.');
  }
});

/**
 * Create a service record for a car and audit the action.
 * Side effects: inserts service record; writes admin audit log.
 * @param {import('express').Request} req - Params: id; body: service fields
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const createServiceRecord = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const userId = req.session?.user?.id ?? null;
    const record = await carAdminService.createServiceRecord(req.params.id, req.body, userId);
    await logAdminAction(req, {
      action: 'admin.created_car_service_record',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { recordId: record.id, serviceType: record.serviceType },
    });
    return apiResponse.success(res, { record }, 201);
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.createCarServiceRecord', 'Error creating service record.');
  }
});

/**
 * Update a service record.
 * Side effects: updates the service record row.
 * @param {import('express').Request} req - Params: id, recordId; body: fields
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const updateServiceRecord = asyncHandler(async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return validationErrorResponse(res, errors);
  }

  try {
    const record = await carAdminService.updateServiceRecord(
      req.params.id,
      req.params.recordId,
      req.body
    );
    return apiResponse.success(res, { record });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.updateCarServiceRecord', 'Error updating service record.');
  }
});

/**
 * Delete a service record.
 * Side effects: deletes the service record row.
 * @param {import('express').Request} req - Params: id, recordId
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 * @returns {Promise<import('express').Response|void>}
 */
const deleteServiceRecord = asyncHandler(async (req, res, next) => {
  try {
    await carAdminService.deleteServiceRecord(req.params.id, req.params.recordId);
    return apiResponse.success(res, { deleted: true });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.deleteCarServiceRecord', 'Error deleting service record.');
  }
});

module.exports = {
  listServiceRecords,
  createServiceRecord,
  updateServiceRecord,
  deleteServiceRecord,
};
