/**
 * Admin car service-record list/create/update/delete handlers.
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
const {
  // Contribute this line to the enclosing declaration or statement.
  validationErrorResponse,
  // Contribute this line to the enclosing declaration or statement.
  notFoundOrForward,
// Continue the surrounding logic with this statement.
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
  // Start a try block for operations that may fail.
  try {
    // Create the records constant.
    const records = await carAdminService.listServiceRecords(req.params.id);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { records });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
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
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the user id constant.
    const userId = req.session?.user?.id ?? null;
    // Create the record constant.
    const record = await carAdminService.createServiceRecord(req.params.id, req.body, userId);
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'admin.created_car_service_record',
      // Provide the entity type field value.
      entityType: 'car',
      // Provide the entity id field value.
      entityId: req.params.id,
      // Provide the metadata field value.
      metadata: { recordId: record.id, serviceType: record.serviceType },
    });
    // Return the resulting value to the caller.
    return apiResponse.success(res, { record }, 201);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
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
  // Create the errors constant.
  const errors = validationResult(req);
  // Evaluate the condition and enter the branch when it is true.
  if (!errors.isEmpty()) {
    // Return the resulting value to the caller.
    return validationErrorResponse(res, errors);
  }

  // Start a try block for operations that may fail.
  try {
    // Create the record constant.
    const record = await carAdminService.updateServiceRecord(
      // Contribute this line to the enclosing declaration or statement.
      req.params.id,
      // Contribute this line to the enclosing declaration or statement.
      req.params.recordId,
      // Contribute this line to the enclosing declaration or statement.
      req.body
    );
    // Return the resulting value to the caller.
    return apiResponse.success(res, { record });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
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
  // Start a try block for operations that may fail.
  try {
    // Wait until the asynchronous operation resolves.
    await carAdminService.deleteServiceRecord(req.params.id, req.params.recordId);
    // Return the resulting value to the caller.
    return apiResponse.success(res, { deleted: true });
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Return the resulting value to the caller.
    return notFoundOrForward(err, req, res, next, 'api.deleteCarServiceRecord', 'Error deleting service record.');
  }
});

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listServiceRecords,
  // Contribute this line to the enclosing declaration or statement.
  createServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  updateServiceRecord,
  // Contribute this line to the enclosing declaration or statement.
  deleteServiceRecord,
};
