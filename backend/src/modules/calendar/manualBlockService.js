const repo = require('./calendar.repository');
const mapper = require('./calendar.eventMapper');
const conflictEngine = require('./calendar.conflictEngine');
const { CALENDAR_PERMISSIONS } = require('./calendar.permissions');
const rbacService = require('../../services/rbac/rbacService');
const { logAdminAction } = require('../../services/admin/adminAuditService');
const { createHttpError, emitCalendarUpdated } = require('./calendar.shared');

async function createManualEvent(access, body, req) {
  if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_BLOCKS)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  const start = new Date(body.start);
  const end = new Date(body.end);
  if (!(start < end)) {
    throw createHttpError('VALIDATION_ERROR', 'Invalid range.', 422);
  }
  const blockType = body.blockType || 'manual';
  if (!['manual', 'maintenance', 'other'].includes(blockType)) {
    throw createHttpError('VALIDATION_ERROR', 'Invalid block type.', 422);
  }

  const conflicts = await conflictEngine.checkReservationRangeConflicts({
    carId: body.carId,
    start,
    end,
  });
  conflictEngine.assertWritable(conflicts, {
    force: Boolean(body.force),
    canOverride: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.OVERRIDE),
  });

  const row = await repo.createManualBlock({
    carId: body.carId,
    start,
    end,
    blockType,
    reason: body.reason,
    notes: body.notes,
    createdByUserId: access.userId,
  });

  await logAdminAction(req, {
    action: 'calendar.block.create',
    entityType: 'car_date_block',
    entityId: String(row.id),
    metadata: { carId: body.carId, blockType },
  });

  emitCalendarUpdated({
    action: 'block_created',
    entityType: 'car_date_block',
    entityId: row.id,
  });

  return mapper.mapBlockEvent(row);
}

async function updateManualEvent(access, blockId, body, req) {
  if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_BLOCKS)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  const existing = await repo.findBlockById(blockId);
  if (!existing) throw createHttpError('NOT_FOUND', 'Block not found.', 404);
  if (existing.block_type === 'booking') {
    throw createHttpError('VALIDATION_ERROR', 'Cannot edit booking-synced blocks.', 422);
  }

  const start = body.start ? new Date(body.start) : new Date(existing.start_date);
  const end = body.end ? new Date(body.end) : new Date(existing.end_date);
  if (!(start < end)) {
    throw createHttpError('VALIDATION_ERROR', 'Invalid range.', 422);
  }
  const blockType = body.blockType || existing.block_type;
  if (!['manual', 'maintenance', 'other'].includes(blockType)) {
    throw createHttpError('VALIDATION_ERROR', 'Invalid block type.', 422);
  }
  const targetCarId = body.carId != null ? Number(body.carId) : Number(existing.car_id);

  const conflicts = await conflictEngine.checkReservationRangeConflicts({
    carId: targetCarId,
    start,
    end,
  });
  conflictEngine.assertWritable(conflicts, {
    force: Boolean(body.force),
    canOverride: rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.OVERRIDE),
  });

  const updated = await repo.updateManualBlock(blockId, {
    start,
    end,
    carId: targetCarId,
    blockType,
    reason: body.reason !== undefined ? body.reason : existing.reason,
    notes: body.notes !== undefined ? body.notes : existing.notes,
  });
  if (!updated) throw createHttpError('NOT_FOUND', 'Block not found.', 404);

  await logAdminAction(req, {
    action: 'calendar.block.update',
    entityType: 'car_date_block',
    entityId: String(blockId),
    metadata: { carId: targetCarId, blockType },
  });

  emitCalendarUpdated({
    action: 'block_updated',
    entityType: 'car_date_block',
    entityId: blockId,
  });

  return mapper.mapBlockEvent(updated);
}

async function deleteManualEvent(access, blockId, req) {
  if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_BLOCKS)) {
    throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
  }
  const existing = await repo.findBlockById(blockId);
  if (!existing) throw createHttpError('NOT_FOUND', 'Block not found.', 404);
  if (existing.block_type === 'booking') {
    throw createHttpError('VALIDATION_ERROR', 'Cannot delete booking-synced blocks.', 422);
  }
  const deleted = await repo.deleteManualBlock(blockId);
  if (!deleted) throw createHttpError('NOT_FOUND', 'Block not found.', 404);

  await logAdminAction(req, {
    action: 'calendar.block.delete',
    entityType: 'car_date_block',
    entityId: String(blockId),
    metadata: { carId: deleted.car_id, blockType: deleted.block_type },
  });

  emitCalendarUpdated({
    action: 'block_deleted',
    entityType: 'car_date_block',
    entityId: blockId,
  });

  return { id: String(blockId), deleted: true };
}

module.exports = {
  createManualEvent,
  updateManualEvent,
  deleteManualEvent,
};
