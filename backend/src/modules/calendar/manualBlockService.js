/**
 * Manual / maintenance / other date-block CRUD for the calendar.
 *
 * Booking-synced blocks cannot be edited here. Writes run under car advisory
 * locks and the conflict engine (force + OVERRIDE for soft conflicts).
 */

const repo = require('./calendar.repository');
// Require the './calendar.eventMapper' module as mapper.
const mapper = require('./calendar.eventMapper');
// Require the './calendar.conflictEngine' module as conflictEngine.
const conflictEngine = require('./calendar.conflictEngine');
// Destructure object properties into local variables.
const { CALENDAR_PERMISSIONS } = require('./calendar.permissions');
// Require the '../../services/rbac/rbacService' module as rbacService.
const rbacService = require('../../services/rbac/rbacService');
// Destructure object properties into local variables.
const { logAdminAction } = require('../../services/admin/adminAuditService');
// Destructure object properties into local variables.
const { createHttpError, emitCalendarUpdated } = require('./calendar.shared');
// Destructure object properties into local variables.
const { runWithTransaction, acquireCarAdvisoryLocks } = require('../../db/transaction');

/**
 * Create a manual date block after conflict checks.
 * @param {object} access
 * @param {object} body
 * @param {object} req
 */
async function createManualEvent(access, body, req) {
  // Evaluate the condition and enter the branch when it is true.
  if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_BLOCKS)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Create the start constant.
  const start = new Date(body.start);
  // Create the end constant.
  const end = new Date(body.end);
  // Evaluate the condition and enter the branch when it is true.
  if (!(start < end)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Invalid range.', 422);
  }
  // booking-synced blocks are not creatable here — only manual/maintenance/other.
  const blockType = body.blockType || 'manual';
  // Evaluate the condition and enter the branch when it is true.
  if (!['manual', 'maintenance', 'other'].includes(blockType)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Invalid block type.', 422);
  }

  // Create the force constant.
  const force = Boolean(body.force);
  // Create the can override constant.
  const canOverride = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.OVERRIDE);

  // Create the row constant.
  const row = await runWithTransaction(async (client) => {
    // Serialize writes for this car with other calendar mutations.
    await acquireCarAdvisoryLocks(client, [body.carId]);

    // Create the conflicts constant.
    const conflicts = await conflictEngine.checkReservationRangeConflicts({
      // Provide the car id field value.
      carId: body.carId,
      // Contribute this line to the enclosing declaration or statement.
      start,
      // Contribute this line to the enclosing declaration or statement.
      end,
      // Contribute this line to the enclosing declaration or statement.
      client,
    });
    // Call conflictEngine.assertWritable to perform this step.
    conflictEngine.assertWritable(conflicts, { force, canOverride });

    // Return the resulting value to the caller.
    return repo.createManualBlock(
      {
        // Provide the car id field value.
        carId: body.carId,
        // Contribute this line to the enclosing declaration or statement.
        start,
        // Contribute this line to the enclosing declaration or statement.
        end,
        // Contribute this line to the enclosing declaration or statement.
        blockType,
        // Provide the reason field value.
        reason: body.reason,
        // Provide the notes field value.
        notes: body.notes,
        // Provide the created by user id field value.
        createdByUserId: access.userId,
      },
      // Reference the identifier used by the enclosing expression.
      client
    );
  });

  // Wait until the asynchronous operation resolves.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'calendar.block.create',
    // Provide the entity type field value.
    entityType: 'car_date_block',
    // Provide the entity id field value.
    entityId: String(row.id),
    // Provide the metadata field value.
    metadata: { carId: body.carId, blockType },
  });

  // Call emitCalendarUpdated to perform this step.
  emitCalendarUpdated({
    // Provide the action field value.
    action: 'block_created',
    // Provide the entity type field value.
    entityType: 'car_date_block',
    // Provide the entity id field value.
    entityId: row.id,
  });

  // Return the resulting value to the caller.
  return mapper.mapBlockEvent(row);
}

/**
 * Update a non-booking block; exclude self from overlap checks via excludeBlockId.
 * @param {object} access
 * @param {string|number} blockId
 * @param {object} body
 * @param {object} req
 */
async function updateManualEvent(access, blockId, body, req) {
  // Evaluate the condition and enter the branch when it is true.
  if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_BLOCKS)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Create the existing constant.
  const existing = await repo.findBlockById(blockId);
  // Evaluate the condition and enter the branch when it is true.
  if (!existing) throw createHttpError('NOT_FOUND', 'Block not found.', 404);
  // Booking-synced blocks mirror reservations — edit via move/resize instead.
  if (existing.block_type === 'booking') {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Cannot edit booking-synced blocks.', 422);
  }

  // Partial update: keep existing dates when body omits start/end.
  const start = body.start ? new Date(body.start) : new Date(existing.start_date);
  // Create the end constant.
  const end = body.end ? new Date(body.end) : new Date(existing.end_date);
  // Evaluate the condition and enter the branch when it is true.
  if (!(start < end)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Invalid range.', 422);
  }
  // Create the block type constant.
  const blockType = body.blockType || existing.block_type;
  // Evaluate the condition and enter the branch when it is true.
  if (!['manual', 'maintenance', 'other'].includes(blockType)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Invalid block type.', 422);
  }
  // Create the target car id constant.
  const targetCarId = body.carId != null ? Number(body.carId) : Number(existing.car_id);
  // Create the force constant.
  const force = Boolean(body.force);
  // Create the can override constant.
  const canOverride = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.OVERRIDE);

  // Create the updated constant.
  const updated = await runWithTransaction(async (client) => {
    // Lock both previous and target car when reassigning.
    await acquireCarAdvisoryLocks(client, [existing.car_id, targetCarId]);

    // Create the conflicts constant.
    const conflicts = await conflictEngine.checkReservationRangeConflicts({
      // Provide the car id field value.
      carId: targetCarId,
      // Contribute this line to the enclosing declaration or statement.
      start,
      // Contribute this line to the enclosing declaration or statement.
      end,
      // Provide the exclude block id field value.
      excludeBlockId: blockId,
      // Contribute this line to the enclosing declaration or statement.
      client,
    });
    // Call conflictEngine.assertWritable to perform this step.
    conflictEngine.assertWritable(conflicts, { force, canOverride });

    // Return the resulting value to the caller.
    return repo.updateManualBlock(
      // Contribute this line to the enclosing declaration or statement.
      blockId,
      {
        // Contribute this line to the enclosing declaration or statement.
        start,
        // Contribute this line to the enclosing declaration or statement.
        end,
        // Provide the car id field value.
        carId: targetCarId,
        // Contribute this line to the enclosing declaration or statement.
        blockType,
        // Provide the reason field value.
        reason: body.reason !== undefined ? body.reason : existing.reason,
        // Provide the notes field value.
        notes: body.notes !== undefined ? body.notes : existing.notes,
      },
      // Reference the identifier used by the enclosing expression.
      client
    );
  });
  // Evaluate the condition and enter the branch when it is true.
  if (!updated) throw createHttpError('NOT_FOUND', 'Block not found.', 404);

  // Wait until the asynchronous operation resolves.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'calendar.block.update',
    // Provide the entity type field value.
    entityType: 'car_date_block',
    // Provide the entity id field value.
    entityId: String(blockId),
    // Provide the metadata field value.
    metadata: { carId: targetCarId, blockType },
  });

  // Call emitCalendarUpdated to perform this step.
  emitCalendarUpdated({
    // Provide the action field value.
    action: 'block_updated',
    // Provide the entity type field value.
    entityType: 'car_date_block',
    // Provide the entity id field value.
    entityId: blockId,
  });

  // Return the resulting value to the caller.
  return mapper.mapBlockEvent(updated);
}

/**
 * Delete a non-booking block and emit calendar update.
 * @param {object} access
 * @param {string|number} blockId
 * @param {object} req
 */
async function deleteManualEvent(access, blockId, req) {
  // Evaluate the condition and enter the branch when it is true.
  if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_BLOCKS)) {
    // Throw an error to stop the current control flow.
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  // Create the existing constant.
  const existing = await repo.findBlockById(blockId);
  // Evaluate the condition and enter the branch when it is true.
  if (!existing) throw createHttpError('NOT_FOUND', 'Block not found.', 404);
  // Evaluate the condition and enter the branch when it is true.
  if (existing.block_type === 'booking') {
    // Throw an error to stop the current control flow.
    throw createHttpError('VALIDATION_ERROR', 'Cannot delete booking-synced blocks.', 422);
  }
  // Create the deleted constant.
  const deleted = await repo.deleteManualBlock(blockId);
  // Evaluate the condition and enter the branch when it is true.
  if (!deleted) throw createHttpError('NOT_FOUND', 'Block not found.', 404);

  // Wait until the asynchronous operation resolves.
  await logAdminAction(req, {
    // Provide the action field value.
    action: 'calendar.block.delete',
    // Provide the entity type field value.
    entityType: 'car_date_block',
    // Provide the entity id field value.
    entityId: String(blockId),
    // Provide the metadata field value.
    metadata: { carId: deleted.car_id, blockType: deleted.block_type },
  });

  // Call emitCalendarUpdated to perform this step.
  emitCalendarUpdated({
    // Provide the action field value.
    action: 'block_deleted',
    // Provide the entity type field value.
    entityType: 'car_date_block',
    // Provide the entity id field value.
    entityId: blockId,
  });

  // Return the resulting value to the caller.
  return { id: String(blockId), deleted: true };
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  createManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  updateManualEvent,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualEvent,
};
