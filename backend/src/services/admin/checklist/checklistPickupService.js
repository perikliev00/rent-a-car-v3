const pickupSql = require('../../sql/pickupChecklistSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { logAdminAction } = require('../adminAuditService');
const {
  FUEL_LEVELS,
  storeUpload,
  storeUploads,
  parseFiles,
  cleanupTemp,
} = require('./checklistUploadHelpers');

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

module.exports = {
  submitPickupChecklist,
};
