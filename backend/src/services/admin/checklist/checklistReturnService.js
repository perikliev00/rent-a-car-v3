const returnSql = require('../../sql/returnChecklistSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const damageReportSql = require('../../sql/carDamageReportSqlService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { logAdminAction } = require('../adminAuditService');
const {
  FUEL_LEVELS,
  storeUpload,
  storeUploads,
  parseFiles,
  cleanupTemp,
} = require('./checklistUploadHelpers');

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
    const { clientQuery } = require('../../../db/transaction');
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

module.exports = {
  submitReturnChecklist,
};
