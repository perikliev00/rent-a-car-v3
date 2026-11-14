/**
 * Submit return checklist: store assets, upsert checklist, optionally create a
 * damage report from newDamages, then mark the reservation returned.
 */
const returnSql = require('../../sql/returnChecklistSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const damageReportSql = require('../../sql/carDamageReportSqlService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { logAdminAction } = require('../adminAuditService');
const { runWithTransaction, clientQuery } = require('../../../db/transaction');
const {
  FUEL_LEVELS,
  storeUpload,
  storeUploads,
  parseFiles,
  cleanupTemp,
} = require('./checklistUploadHelpers');

/**
 * @param {import('express').Request} req
 * @param {number|string} reservationId
 * @param {object} body
 */
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
  const actor = { type: 'admin', req, userId: req.session?.user?.id };
  const carId = reservation.carId?.id || reservation.carId;

  const { checklist, reservation: updatedReservation } = await runWithTransaction(
    async (client) => {
      const latest = await reservationSql.findByIdForUpdate(reservationId, client);
      if (!latest) {
        const err = new Error('Reservation not found');
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
      }

      // Only in-progress or already-returned rentals may submit/update a return checklist.
      // Allow `returned` for idempotent retries; refuse confirmed/cancelled/etc. early.
      const allowed = new Set(['picked_up', 'active_rental', 'returned']);
      if (!allowed.has(latest.status)) {
        const err = new Error(
          `Cannot submit return checklist while reservation is '${latest.status}'.`
        );
        err.code = 'INVALID_STATUS_TRANSITION';
        err.status = 422;
        throw err;
      }

      const checklistRow = await returnSql.upsert(
        {
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
        },
        client
      );

      // Clearing newDamages leaves any prior auto damage row in place (ops must resolve
      // or edit explicitly); only non-empty descriptions upsert the auto report.
      if (body.newDamages && carId) {
        await damageReportSql.upsertForReservation(
          carId,
          {
            description: body.newDamages,
            reservationId,
            photos: [],
            repairCost: extraFees > 0 ? extraFees : null,
            reportedByUserId: req.session?.user?.id ?? null,
            source: damageReportSql.DAMAGE_SOURCES.RETURN_CHECKLIST,
          },
          client
        );
      }

      if (carId) {
        await clientQuery(
          client,
          `
          UPDATE cars
          SET mileage = $2, fuel_level = $3, updated_at = NOW()
          WHERE id = $1
          `,
          [Number(carId), mileage, body.fuelLevel]
        );
      }

      let statusResult = null;
      if (latest.status === 'picked_up' || latest.status === 'active_rental') {
        if (latest.status === 'picked_up') {
          await changeStatus({
            reservationId,
            newStatus: 'active_rental',
            reason: 'return_checklist_prep',
            actor,
            client,
          });
        }
        statusResult = await changeStatus({
          reservationId,
          newStatus: 'returned',
          reason: 'return_checklist_completed',
          actor,
          metadata: {
            checklistId: checklistRow.id,
            lateReturn: checklistRow.lateReturn,
            extraFees: checklistRow.extraFees,
          },
          client,
        });
      }

      return {
        checklist: checklistRow,
        reservation: statusResult?.reservation || latest,
      };
    }
  );

  await logAdminAction(req, {
    action: 'admin.return_checklist_saved',
    entityType: 'reservation',
    entityId: reservationId,
    metadata: { checklistId: checklist.id, extraFees: checklist.extraFees },
  });

  return { checklist, reservation: updatedReservation };
}

module.exports = {
  submitReturnChecklist,
};
