const privateStorage = require('../storage/privateStorageService');
const { removeUploadedFile } = require('../../middleware/fileUpload/uploadUtils');
const pickupSql = require('../sql/pickupChecklistSqlService');
const returnSql = require('../sql/returnChecklistSqlService');
const cancellationSql = require('../sql/cancellationRequestSqlService');
const reservationSql = require('../sql/reservationSqlService');
const damageReportSql = require('../sql/carDamageReportSqlService');
const { changeStatus } = require('../reservation/reservationStatusService');
const { logAdminAction } = require('./adminAuditService');
const { generatePdf } = require('../pdf/pdfDocumentService');
const { REFUNDABLE_STATUSES } = require('../payment/refund/refundPolicy');
const { requestReservationRefund } = require('../payment/refund/reservationRefundService');

const FUEL_LEVELS = new Set(['empty', 'quarter', 'half', 'three_quarters', 'full']);

async function storeUpload(file, category) {
  if (!file) return null;
  const stored = await privateStorage.storePrivateFile({
    tempPath: file.path,
    originalName: file.originalname,
    category,
    mimeType: file.mimetype,
  });
  return stored.storageKey;
}

async function storeUploads(files = [], category) {
  const keys = [];
  for (const file of files) {
    keys.push(await storeUpload(file, category));
  }
  return keys.filter(Boolean);
}

function parseFiles(req) {
  const files = req.files || {};
  return {
    photos: files.photos || [],
    customerSignature: files.customerSignature?.[0] || null,
    employeeSignature: files.employeeSignature?.[0] || null,
  };
}

async function cleanupTemp(req) {
  const { photos, customerSignature, employeeSignature } = parseFiles(req);
  for (const f of [...photos, customerSignature, employeeSignature].filter(Boolean)) {
    await removeUploadedFile(f);
  }
}

async function submitPickupChecklist(req, reservationId, body) {
  const reservation = await reservationSql.findById(reservationId);
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!FUEL_LEVELS.has(body.fuelLevel)) {
    await cleanupTemp(req);
    const err = new Error('Invalid fuel level.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  const mileage = Number(body.mileage);
  if (!Number.isInteger(mileage) || mileage < 0) {
    await cleanupTemp(req);
    const err = new Error('Mileage must be a non-negative integer.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  const { photos, customerSignature, employeeSignature } = parseFiles(req);
  let photoKeys;
  let customerSignatureKey;
  let employeeSignatureKey;
  try {
    photoKeys = await storeUploads(photos, 'checklists');
    customerSignatureKey = await storeUpload(customerSignature, 'signatures');
    employeeSignatureKey = await storeUpload(employeeSignature, 'signatures');
  } catch (err) {
    await cleanupTemp(req);
    throw err;
  }

  const checklist = await pickupSql.upsert({
    reservationId,
    fuelLevel: body.fuelLevel,
    mileage,
    existingDamages: body.existingDamages || null,
    photos: photoKeys,
    customerSignatureKey,
    employeeSignatureKey,
    pickupTime: body.pickupTime ? new Date(body.pickupTime) : new Date(),
    notes: body.notes || null,
    createdByUserId: req.session?.user?.id ?? null,
  });

  const carId = reservation.carId?.id || reservation.carId;
  if (carId) {
    const { clientQuery } = require('../../db/transaction');
    await clientQuery(
      null,
      `
      UPDATE cars
      SET mileage = $2, fuel_level = $3, updated_at = NOW()
      WHERE id = $1
      `,
      [Number(carId), mileage, body.fuelLevel]
    );
  }

  let statusResult = null;
  if (reservation.status === 'car_prepared' || reservation.status === 'confirmed') {
    const from = reservation.status === 'confirmed' ? 'car_prepared' : reservation.status;
    if (reservation.status === 'confirmed') {
      await changeStatus({
        reservationId,
        newStatus: 'car_prepared',
        reason: 'pickup_checklist_prep',
        actor: { type: 'admin', req, userId: req.session?.user?.id },
      });
    }
    statusResult = await changeStatus({
      reservationId,
      newStatus: 'picked_up',
      reason: 'pickup_checklist_completed',
      actor: { type: 'admin', req, userId: req.session?.user?.id },
      metadata: { checklistId: checklist.id, from },
    });
  }

  await logAdminAction(req, {
    action: 'admin.pickup_checklist_saved',
    entityType: 'reservation',
    entityId: reservationId,
    metadata: { checklistId: checklist.id },
  });

  return { checklist, reservation: statusResult?.reservation || reservation };
}

async function submitReturnChecklist(req, reservationId, body) {
  const reservation = await reservationSql.findById(reservationId);
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!FUEL_LEVELS.has(body.fuelLevel)) {
    await cleanupTemp(req);
    const err = new Error('Invalid fuel level.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  const mileage = Number(body.mileage);
  if (!Number.isInteger(mileage) || mileage < 0) {
    await cleanupTemp(req);
    const err = new Error('Mileage must be a non-negative integer.');
    err.code = 'VALIDATION_ERROR';
    err.status = 422;
    throw err;
  }

  const { photos, customerSignature, employeeSignature } = parseFiles(req);
  let photoKeys;
  let customerSignatureKey;
  let employeeSignatureKey;
  try {
    photoKeys = await storeUploads(photos, 'checklists');
    customerSignatureKey = await storeUpload(customerSignature, 'signatures');
    employeeSignatureKey = await storeUpload(employeeSignature, 'signatures');
  } catch (err) {
    await cleanupTemp(req);
    throw err;
  }

  const extraFees = Number(body.extraFees || 0);
  const checklist = await returnSql.upsert({
    reservationId,
    fuelLevel: body.fuelLevel,
    mileage,
    newDamages: body.newDamages || null,
    photos: photoKeys,
    lateReturn: body.lateReturn === true || body.lateReturn === 'true',
    extraFees: Number.isFinite(extraFees) ? extraFees : 0,
    customerSignatureKey,
    employeeSignatureKey,
    returnTime: body.returnTime ? new Date(body.returnTime) : new Date(),
    notes: body.notes || null,
    createdByUserId: req.session?.user?.id ?? null,
  });

  const carId = reservation.carId?.id || reservation.carId;
  if (body.newDamages && carId) {
    await damageReportSql.create(carId, {
      description: body.newDamages,
      reservationId,
      photos: [],
      repairCost: extraFees > 0 ? extraFees : null,
      reportedByUserId: req.session?.user?.id ?? null,
    });
  }

  if (carId) {
    const { clientQuery } = require('../../db/transaction');
    await clientQuery(
      null,
      `
      UPDATE cars
      SET mileage = $2, fuel_level = $3, updated_at = NOW()
      WHERE id = $1
      `,
      [Number(carId), mileage, body.fuelLevel]
    );
  }

  let statusResult = null;
  if (reservation.status === 'picked_up' || reservation.status === 'active_rental') {
    if (reservation.status === 'picked_up') {
      await changeStatus({
        reservationId,
        newStatus: 'active_rental',
        reason: 'return_checklist_prep',
        actor: { type: 'admin', req, userId: req.session?.user?.id },
      });
    }
    statusResult = await changeStatus({
      reservationId,
      newStatus: 'returned',
      reason: 'return_checklist_completed',
      actor: { type: 'admin', req, userId: req.session?.user?.id },
      metadata: {
        checklistId: checklist.id,
        lateReturn: checklist.lateReturn,
        extraFees: checklist.extraFees,
      },
    });
  }

  await logAdminAction(req, {
    action: 'admin.return_checklist_saved',
    entityType: 'reservation',
    entityId: reservationId,
    metadata: { checklistId: checklist.id, extraFees: checklist.extraFees },
  });

  return { checklist, reservation: statusResult?.reservation || reservation };
}

async function listCancellationRequests() {
  return cancellationSql.listPending({ limit: 50 });
}

async function reviewCancellationRequest(req, requestId, { approve, adminNote }) {
  const existing = await cancellationSql.findById(requestId);
  if (!existing || existing.status !== 'pending') {
    const err = new Error('Cancellation request not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }

  if (!approve) {
    const reviewed = await cancellationSql.review({
      id: requestId,
      status: 'rejected',
      adminNote,
      reviewedByUserId: req.session?.user?.id ?? null,
    });
    const reservation = await reservationSql.findById(existing.reservationId);
    await logAdminAction(req, {
      action: 'admin.cancellation_request_rejected',
      entityType: 'reservation',
      entityId: existing.reservationId,
      metadata: { requestId, adminNote: adminNote || null },
    });
    return { cancellationRequest: reviewed, reservation };
  }

  let reservation = await reservationSql.findById(existing.reservationId);
  let refundResult = null;

  if (reservation && reservation.status !== 'cancelled') {
    if (REFUNDABLE_STATUSES.includes(reservation.status)) {
      try {
        refundResult = await requestReservationRefund(req, {
          reservationId: existing.reservationId,
          reason: adminNote || 'cancellation_request_approved',
        });
        reservation = refundResult.reservation;
      } catch (err) {
        if (err.code === 'REFUND_NO_PAYMENT_INTENT' || err.code === 'REFUND_NO_AMOUNT') {
          const result = await changeStatus({
            reservationId: existing.reservationId,
            newStatus: 'cancelled',
            reason: adminNote || 'cancellation_request_approved',
            actor: { type: 'admin', req, userId: req.session?.user?.id },
            metadata: { cancellationRequestId: requestId },
          });
          reservation = result.reservation;
        } else {
          throw err;
        }
      }
    } else {
      const result = await changeStatus({
        reservationId: existing.reservationId,
        newStatus: 'cancelled',
        reason: adminNote || 'cancellation_request_approved',
        actor: { type: 'admin', req, userId: req.session?.user?.id },
        metadata: { cancellationRequestId: requestId },
      });
      reservation = result.reservation;
    }
  }

  const reviewed = await cancellationSql.review({
    id: requestId,
    status: 'approved',
    adminNote,
    reviewedByUserId: req.session?.user?.id ?? null,
  });

  await logAdminAction(req, {
    action: 'admin.cancellation_request_approved',
    entityType: 'reservation',
    entityId: existing.reservationId,
    metadata: {
      requestId,
      adminNote: adminNote || null,
      refundOperationId: refundResult?.refundOperation?.id || null,
      refundStatus: refundResult?.status || null,
    },
  });

  return { cancellationRequest: reviewed, reservation };
}

async function downloadReservationPdf(reservationId, kind) {
  const reservation = await reservationSql.findById(reservationId);
  if (!reservation) {
    const err = new Error('Reservation not found');
    err.code = 'NOT_FOUND';
    err.status = 404;
    throw err;
  }
  return generatePdf(kind, reservation);
}

async function getChecklists(reservationId) {
  const pickupChecklist = await pickupSql.findByReservationId(reservationId);
  const returnChecklist = await returnSql.findByReservationId(reservationId);
  return { pickupChecklist, returnChecklist };
}

module.exports = {
  submitPickupChecklist,
  submitReturnChecklist,
  listCancellationRequests,
  reviewCancellationRequest,
  downloadReservationPdf,
  getChecklists,
};
