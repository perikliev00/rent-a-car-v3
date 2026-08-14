const { validationResult } = require('express-validator');
const carAdminService = require('../../../services/admin/carAdminService');
const { logAdminAction } = require('../../../services/admin/adminAuditService');
const { removeUploadedFile } = require('../../../middleware/fileUpload/uploadUtils');
const apiResponse = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { forwardControllerError } = require('../../../utils/controllerError');
const logger = require('../../../utils/logger');

function validationErrorResponse(res, errors) {
  return apiResponse.error(
    res,
    'VALIDATION_ERROR',
    errors.array()[0].msg,
    422
  );
}

async function cleanupUploads(req) {
  if (req.file) await removeUploadedFile(req.file);
  if (Array.isArray(req.files)) {
    for (const file of req.files) {
      await removeUploadedFile(file);
    }
  }
}

function notFoundOrForward(err, req, res, next, context, publicMessage) {
  if (err.message === 'Car not found' || err.message?.includes('not found')) {
    return apiResponse.error(res, 'NOT_FOUND', err.message, 404);
  }
  return forwardControllerError(err, req, next, { context, publicMessage });
}

exports.listCars = asyncHandler(async (req, res, next) => {
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

exports.getFleetAlerts = asyncHandler(async (req, res, next) => {
  try {
    const data = await carAdminService.getFleetAlerts();
    return apiResponse.success(res, data);
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.getFleetAlerts',
      publicMessage: 'Error loading fleet alerts.',
    });
  }
});

exports.reconcileFleetAlerts = asyncHandler(async (req, res, next) => {
  try {
    const result = await carAdminService.reconcileFleetAlerts(new Date());
    await logAdminAction(req, {
      action: 'admin.reconciled_fleet_alerts',
      entityType: 'fleet_alerts',
      metadata: result || {},
    });
    const data = await carAdminService.getFleetAlerts();
    return apiResponse.success(res, { reconcile: result, ...data });
  } catch (err) {
    return forwardControllerError(err, req, next, {
      context: 'api.reconcileFleetAlerts',
      publicMessage: 'Error reconciling fleet alerts.',
    });
  }
});

exports.getCarById = asyncHandler(async (req, res, next) => {
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

exports.createCar = asyncHandler(async (req, res, _next) => {
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

exports.updateCar = asyncHandler(async (req, res, _next) => {
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

exports.deleteCar = asyncHandler(async (req, res, next) => {
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

exports.changeFleetStatus = asyncHandler(async (req, res, next) => {
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

exports.listServiceRecords = asyncHandler(async (req, res, next) => {
  try {
    const records = await carAdminService.listServiceRecords(req.params.id);
    return apiResponse.success(res, { records });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarServiceRecords', 'Error loading service records.');
  }
});

exports.createServiceRecord = asyncHandler(async (req, res, next) => {
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

exports.updateServiceRecord = asyncHandler(async (req, res, next) => {
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

exports.deleteServiceRecord = asyncHandler(async (req, res, next) => {
  try {
    await carAdminService.deleteServiceRecord(req.params.id, req.params.recordId);
    return apiResponse.success(res, { deleted: true });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.deleteCarServiceRecord', 'Error deleting service record.');
  }
});

exports.listDamageReports = asyncHandler(async (req, res, next) => {
  try {
    const reports = await carAdminService.listDamageReports(req.params.id);
    return apiResponse.success(res, { reports });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarDamageReports', 'Error loading damage reports.');
  }
});

exports.createDamageReport = asyncHandler(async (req, res, next) => {
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

    const userId = req.session?.user?.id ?? null;
    const report = await carAdminService.createDamageReport(
      req.params.id,
      req.body,
      req.files || [],
      userId
    );
    await logAdminAction(req, {
      action: 'admin.created_car_damage_report',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { reportId: report.id },
    });
    return apiResponse.success(res, { report }, 201);
  } catch (err) {
    await cleanupUploads(req);
    return notFoundOrForward(err, req, res, next, 'api.createCarDamageReport', 'Error creating damage report.');
  }
});

exports.resolveDamageReport = asyncHandler(async (req, res, next) => {
  try {
    const report = await carAdminService.resolveDamageReport(req.params.id, req.params.reportId);
    await logAdminAction(req, {
      action: 'admin.resolved_car_damage_report',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { reportId: report.id },
    });
    return apiResponse.success(res, { report });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.resolveCarDamageReport', 'Error resolving damage report.');
  }
});

exports.deleteDamageReport = asyncHandler(async (req, res, next) => {
  try {
    await carAdminService.deleteDamageReport(req.params.id, req.params.reportId);
    return apiResponse.success(res, { deleted: true });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.deleteCarDamageReport', 'Error deleting damage report.');
  }
});

exports.listDocuments = asyncHandler(async (req, res, next) => {
  try {
    const documents = await carAdminService.listDocuments(req.params.id);
    return apiResponse.success(res, { documents });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarDocuments', 'Error loading documents.');
  }
});

exports.uploadDocument = asyncHandler(async (req, res, next) => {
  try {
    if (req.fileValidationError) {
      await cleanupUploads(req);
      return apiResponse.error(res, 'VALIDATION_ERROR', req.fileValidationError, 422);
    }

    const userId = req.session?.user?.id ?? null;
    const document = await carAdminService.uploadDocument(
      req.params.id,
      req.file,
      req.body.name,
      userId
    );
    await logAdminAction(req, {
      action: 'admin.uploaded_car_document',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { documentId: document.id, name: document.name },
    });
    return apiResponse.success(res, { document }, 201);
  } catch (err) {
    await cleanupUploads(req);
    return notFoundOrForward(err, req, res, next, 'api.uploadCarDocument', 'Error uploading document.');
  }
});

exports.deleteDocument = asyncHandler(async (req, res, next) => {
  try {
    await carAdminService.deleteDocument(req.params.id, req.params.docId);
    return apiResponse.success(res, { deleted: true });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.deleteCarDocument', 'Error deleting document.');
  }
});

exports.listCompliance = asyncHandler(async (req, res, next) => {
  try {
    const items = await carAdminService.listCompliance(req.params.id);
    return apiResponse.success(res, { items });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.listCarCompliance', 'Error loading compliance items.');
  }
});

exports.createCompliance = asyncHandler(async (req, res, next) => {
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

    const userId = req.session?.user?.id ?? null;
    const item = await carAdminService.createCompliance(
      req.params.id,
      req.body,
      req.file || null,
      userId
    );
    await logAdminAction(req, {
      action: 'admin.created_car_compliance_item',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { itemId: item.id, itemType: item.itemType },
    });
    return apiResponse.success(res, { item }, 201);
  } catch (err) {
    await cleanupUploads(req);
    return notFoundOrForward(err, req, res, next, 'api.createCarCompliance', 'Error creating compliance item.');
  }
});

exports.updateCompliance = asyncHandler(async (req, res, next) => {
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

    const item = await carAdminService.updateCompliance(
      req.params.id,
      req.params.itemId,
      req.body,
      req.file || null
    );
    await logAdminAction(req, {
      action: 'admin.updated_car_compliance_item',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { itemId: item.id, itemType: item.itemType },
    });
    return apiResponse.success(res, { item });
  } catch (err) {
    await cleanupUploads(req);
    return notFoundOrForward(err, req, res, next, 'api.updateCarCompliance', 'Error updating compliance item.');
  }
});

exports.deleteCompliance = asyncHandler(async (req, res, next) => {
  try {
    await carAdminService.deleteCompliance(req.params.id, req.params.itemId);
    await logAdminAction(req, {
      action: 'admin.deleted_car_compliance_item',
      entityType: 'car',
      entityId: req.params.id,
      metadata: { itemId: Number(req.params.itemId) },
    });
    return apiResponse.success(res, { deleted: true });
  } catch (err) {
    return notFoundOrForward(err, req, res, next, 'api.deleteCarCompliance', 'Error deleting compliance item.');
  }
});
