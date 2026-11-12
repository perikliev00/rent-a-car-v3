/**
 * Submit return checklist: store assets, upsert checklist, optionally create a
 * damage report from newDamages, then mark the reservation returned.
 */
const returnSql = require('../../sql/returnChecklistSqlService');
// Require the '../../sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../sql/reservationSqlService');
// Require the '../../sql/carDamageReportSqlService' module as damageReportSql.
const damageReportSql = require('../../sql/carDamageReportSqlService');
// Destructure object properties into local variables.
const { changeStatus } = require('../../reservation/reservationStatusService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../adminAuditService');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  FUEL_LEVELS,
  // Contribute this line to the enclosing declaration or statement.
  storeUpload,
  // Contribute this line to the enclosing declaration or statement.
  storeUploads,
  // Contribute this line to the enclosing declaration or statement.
  parseFiles,
  // Contribute this line to the enclosing declaration or statement.
  cleanupTemp,
// Continue the surrounding logic with this statement.
} = require('./checklistUploadHelpers');

/**
 * @param {import('express').Request} req
 * @param {number|string} reservationId
 * @param {object} body
 */
async function submitReturnChecklist(req, reservationId, body) {
  // Create the reservation constant.
  const reservation = await reservationSql.findById(reservationId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!reservation) {
    // Create the err constant.
    const err = new Error('Reservation not found');
    // Update err.code with the right-hand side value.
    err.code = 'NOT_FOUND';
    // Update err.status with the right-hand side value.
    err.status = 404;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Guard: early-return or throw when required input is missing/invalid.
  if (!FUEL_LEVELS.has(body.fuelLevel)) {
    // Wait until the asynchronous operation resolves.
    await cleanupTemp(req);
    // Create the err constant.
    const err = new Error('Invalid fuel level.');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the mileage constant.
  const mileage = Number(body.mileage);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(mileage) || mileage < 0) {
    // Wait until the asynchronous operation resolves.
    await cleanupTemp(req);
    // Create the err constant.
    const err = new Error('Mileage must be a non-negative integer.');
    // Update err.code with the right-hand side value.
    err.code = 'VALIDATION_ERROR';
    // Update err.status with the right-hand side value.
    err.status = 422;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Destructure object properties into local variables.
  const { photos, customerSignature, employeeSignature } = parseFiles(req);
  // Reserve the photo keys variable for later assignment.
  let photoKeys;
  // Reserve the customer signature key variable for later assignment.
  let customerSignatureKey;
  // Reserve the employee signature key variable for later assignment.
  let employeeSignatureKey;
  // Protected block: isolate failure modes.
  try {
    // Store the awaited result in photoKeys.
    photoKeys = await storeUploads(photos, 'checklists');
    // Store the awaited result in customerSignatureKey.
    customerSignatureKey = await storeUpload(customerSignature, 'signatures');
    // Store the awaited result in employeeSignatureKey.
    employeeSignatureKey = await storeUpload(employeeSignature, 'signatures');
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Wait until the asynchronous operation resolves.
    await cleanupTemp(req);
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the extra fees constant.
  const extraFees = Number(body.extraFees || 0);
  // Create the checklist constant.
  const checklist = await returnSql.upsert({
    // Contribute this line to the enclosing declaration or statement.
    reservationId,
    // Provide the fuel level field value.
    fuelLevel: body.fuelLevel,
    // Contribute this line to the enclosing declaration or statement.
    mileage,
    // Provide the new damages field value.
    newDamages: body.newDamages || null,
    // Provide the photos field value.
    photos: photoKeys,
    // Provide the late return field value.
    lateReturn: body.lateReturn === true || body.lateReturn === 'true',
    // Provide the extra fees field value.
    extraFees: Number.isFinite(extraFees) ? extraFees : 0,
    // Contribute this line to the enclosing declaration or statement.
    customerSignatureKey,
    // Contribute this line to the enclosing declaration or statement.
    employeeSignatureKey,
    // Provide the return time field value.
    returnTime: body.returnTime ? new Date(body.returnTime) : new Date(),
    // Provide the notes field value.
    notes: body.notes || null,
    // Provide the created by user id field value.
    createdByUserId: req.session?.user?.id ?? null,
  });

  // Create the car id constant.
  const carId = reservation.carId?.id || reservation.carId;
  // Evaluate the condition and enter the branch when it is true.
  if (body.newDamages && carId) {
    // Wait until the asynchronous operation resolves.
    await damageReportSql.create(carId, {
      // Provide the description field value.
      description: body.newDamages,
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Provide the photos field value.
      photos: [],
      // Provide the repair cost field value.
      repairCost: extraFees > 0 ? extraFees : null,
      // Provide the reported by user id field value.
      reportedByUserId: req.session?.user?.id ?? null,
    });
  }

  // Evaluate the condition and enter the branch when it is true.
  if (carId) {
    // Destructure object properties into local variables.
    const { clientQuery } = require('../../../db/transaction');
    // Wait until the asynchronous operation resolves.
    await clientQuery(
      // Supply the literal value used by the enclosing expression.
      null,
      // Continue the surrounding logic with this statement.
      `
      UPDATE cars
      SET mileage = $2, fuel_level = $3, updated_at = NOW()
      WHERE id = $1
      `,
      // Continue the surrounding logic with this statement.
      [Number(carId), mileage, body.fuelLevel]
    );
  }

  // Initialize the mutable status result variable.
  let statusResult = null;
  // Status / lifecycle guard before mutating domain state.
  if (reservation.status === 'picked_up' || reservation.status === 'active_rental') {
    // Status / lifecycle guard before mutating domain state.
    if (reservation.status === 'picked_up') {
      // Wait until the asynchronous operation resolves.
      await changeStatus({
        // Contribute this line to the enclosing declaration or statement.
        reservationId,
        // Provide the new status field value.
        newStatus: 'active_rental',
        // Provide the reason field value.
        reason: 'return_checklist_prep',
        // Provide the actor field value.
        actor: { type: 'admin', req, userId: req.session?.user?.id },
      });
    }
    // Store the awaited result in statusResult.
    statusResult = await changeStatus({
      // Contribute this line to the enclosing declaration or statement.
      reservationId,
      // Provide the new status field value.
      newStatus: 'returned',
      // Provide the reason field value.
      reason: 'return_checklist_completed',
      // Provide the actor field value.
      actor: { type: 'admin', req, userId: req.session?.user?.id },
      // Provide the metadata field value.
      metadata: {
        // Provide the checklist id field value.
        checklistId: checklist.id,
        // Provide the late return field value.
        lateReturn: checklist.lateReturn,
        // Provide the extra fees field value.
        extraFees: checklist.extraFees,
      },
    });
  }

  // Wait until the asynchronous operation resolves.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'admin.return_checklist_saved',
    // Provide the entity type field value.
    entityType: 'reservation',
    // Provide the entity id field value.
    entityId: reservationId,
    // Provide the metadata field value.
    metadata: { checklistId: checklist.id, extraFees: checklist.extraFees },
  });

  // Return the resulting value to the caller.
  return { checklist, reservation: statusResult?.reservation || reservation };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  submitReturnChecklist,
};
