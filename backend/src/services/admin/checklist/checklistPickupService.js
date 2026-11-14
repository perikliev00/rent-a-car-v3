/**
 * Submit pickup checklist: store photos/signatures, upsert checklist row,
 * then advance reservation toward picked_up / active_rental as appropriate.
 */
const pickupSql = require('../../sql/pickupChecklistSqlService');
const reservationSql = require('../../sql/reservationSqlService');
const { changeStatus } = require('../../reservation/reservationStatusService');
const { logAdminAction } = require('../adminAuditService');
const { runWithTransaction, acquireCarAdvisoryLocks, clientQuery } = require('../../../db/transaction');
const {
  FUEL_LEVELS,
  storeUpload,
  storeUploads,
  parseFiles,
  cleanupTemp,
} = require('./checklistUploadHelpers');

/**
 * Validate, upload assets, persist checklist, and transition reservation status.
 * Cleans up temp uploads on validation/storage failure.
 * @param {import('express').Request} req
 * @param {number|string} reservationId
 * @param {object} body
 */
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

  // Guards before any upload/DB mutation so refused pickups leave no partial state.
  const refundOpSql = require('../../sql/refundOperationSqlService');
  const activeRefund = await refundOpSql.findActiveByReservationId(reservationId);
  if (activeRefund?.status === 'pending') {
    await cleanupTemp(req);
    const err = new Error(
      'A refund is pending for this reservation. Pickup and cancellation are blocked until the refund completes.'
    );
    err.code = 'REFUND_IN_PROGRESS';
    err.status = 409;
    throw err;
  }

  const carIdForGuard = reservation.carId?.id || reservation.carId;
  if (carIdForGuard) {
    const { assertNoOpenPhysicalRental } = require('../order/orderConflictService');
    try {
      await assertNoOpenPhysicalRental(carIdForGuard, null, {
        excludeReservationId: reservationId,
      });
    } catch (err) {
      await cleanupTemp(req);
      if (err.isOrderFormError) {
        const mapped = new Error(err.message);
        mapped.code = 'OPEN_PHYSICAL_RENTAL';
        mapped.status = 409;
        throw mapped;
      }
      throw err;
    }
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

  const actor = { type: 'admin', req, userId: req.session?.user?.id ?? null };

  const { checklist, reservation: updatedReservation } = await runWithTransaction(
    async (client) => {
      const carId = carIdForGuard ? Number(carIdForGuard) : null;
      if (carId) {
        await acquireCarAdvisoryLocks(client, [carId]);
        const { assertNoOpenPhysicalRental } = require('../order/orderConflictService');
        try {
          await assertNoOpenPhysicalRental(carId, client, {
            excludeReservationId: reservationId,
          });
        } catch (err) {
          if (err.isOrderFormError) {
            const mapped = new Error(err.message);
            mapped.code = 'OPEN_PHYSICAL_RENTAL';
            mapped.status = 409;
            throw mapped;
          }
          throw err;
        }
      }

      const latest = await reservationSql.findById(reservationId, client);
      if (!latest) {
        const err = new Error('Reservation not found');
        err.code = 'NOT_FOUND';
        err.status = 404;
        throw err;
      }

      const checklistRow = await pickupSql.upsert(
        {
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
        },
        client
      );

      if (carId) {
        await clientQuery(
          client,
          `
          UPDATE cars
          SET mileage = $2, fuel_level = $3, updated_at = NOW()
          WHERE id = $1
          `,
          [carId, mileage, body.fuelLevel]
        );
      }

      let statusResult = null;
      // Status / lifecycle guard before mutating domain state.
      if (latest.status === 'car_prepared' || latest.status === 'confirmed') {
        const from = latest.status === 'confirmed' ? 'car_prepared' : latest.status;
        // Status / lifecycle guard before mutating domain state.
        if (latest.status === 'confirmed') {
          await changeStatus({
            reservationId,
            newStatus: 'car_prepared',
            reason: 'pickup_checklist_prep',
            actor,
            client,
          });
        }
        statusResult = await changeStatus({
          reservationId,
          newStatus: 'picked_up',
          reason: 'pickup_checklist_completed',
          actor,
          metadata: { checklistId: checklistRow.id, from },
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
    action: 'admin.pickup_checklist_saved',
    entityType: 'reservation',
    entityId: reservationId,
    metadata: { checklistId: checklist.id },
  });

  return { checklist, reservation: updatedReservation };
}

module.exports = {
  submitPickupChecklist,
};
