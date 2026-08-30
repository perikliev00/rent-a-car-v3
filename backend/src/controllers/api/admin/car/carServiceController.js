const { validationResult } = require('express-validator');
const carAdminService = require('../../../../services/admin/carAdminService');
const { logAdminAction } = require('../../../../services/admin/adminAuditService');
const apiResponse = require('../../../../utils/apiResponse');
const asyncHandler = require('../../../../utils/asyncHandler');
const {
  validationErrorResponse,
  notFoundOrForward,
} = require('./carControllerHelpers');

const listServiceRecords = asyncHandler(async (req, res, next) => {
  try {
    const records = await carAdminService.listServiceRecords(req.params.id);
    return apiResponse.success(res, { records });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarServiceRecords', 'Error loading service records.');
  }
});

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
