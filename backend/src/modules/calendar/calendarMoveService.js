const repo = require('./calendar.repository');
const mapper = require('./calendar.eventMapper');
const conflictEngine = require('./calendar.conflictEngine');
const { CALENDAR_PERMISSIONS } = require('./calendar.permissions');
const rbacService = require('../../services/rbac/rbacService');
const { logAdminAction } = require('../../services/admin/adminAuditService');
const bookingSync = require('../../services/sql/bookingSyncSqlService');
const reservationSql = require('../../services/sql/reservationSqlService');
const { runWithTransaction, clientQuery } = require('../../db/transaction');
const {
  syncLinkedOrderAfterReservationMove,
} = require('../../services/admin/order/orderReservationSync');
const { createHttpError, emitCalendarUpdated } = require('./calendar.shared');

/** Soft calendar blocks that force-override is allowed to clear for a reservation move/resize. */
async function clearOverridableBlocksInRange(carId, start, end, client) {
  await clientQuery(
    client,
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1
      AND block_type IN ('manual', 'maintenance', 'other')
      AND start_date < $3
      AND end_date > $2
    `,
    [Number(carId), start, end]
  );
}

async function moveOrResizeEvent(access, eventId, body, req, mode) {
  const parsed = mapper.parseEventId(eventId);
  if (!parsed) throw createHttpError('VALIDATION_ERROR', 'Invalid event id.', 422);

  const force = Boolean(body.force);
  const canOverride = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.OVERRIDE);
  const start = new Date(body.start);
  const end = new Date(body.end);

  if (parsed.type === 'reservation') {
    const perm = mode === 'resize' ? CALENDAR_PERMISSIONS.RESIZE : CALENDAR_PERMISSIONS.MOVE;
    if (!rbacService.userHasPermission(access, perm)) {
      throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
    }
    if (!(start < end)) {
      throw createHttpError('VALIDATION_ERROR', 'Invalid range.', 422);
    }

    const existing = await reservationSql.findById(parsed.id);
    if (!existing) throw createHttpError('NOT_FOUND', 'Reservation not found.', 404);

    const targetCarId = body.carId != null ? Number(body.carId) : Number(
      existing.carId?.id || existing.carId
    );
    const conflicts = await conflictEngine.checkReservationRangeConflicts({
      carId: targetCarId,
      start,
      end,
      excludeReservationId: existing.id,
    });
    // Ignore booking-synced blocks (they represent this reservation's own range)
    const writableConflicts = conflicts.filter(
      (c) => !(c.code === 'BLOCK_OVERLAP' && c.blockType === 'booking')
    );
    conflictEngine.assertWritable(writableConflicts, { force, canOverride });

    const prevStart = existing.pickupDate;
    const prevEnd = existing.returnDate;
    const prevCarId = Number(existing.carId?.id || existing.carId);
    let orderSynced = false;

    await runWithTransaction(async (client) => {
      const { pricing, orderSynced: synced } = await syncLinkedOrderAfterReservationMove({
        reservationId: existing.id,
        carId: targetCarId,
        start,
        end,
        pickupTime: existing.pickupTime,
        returnTime: existing.returnTime,
        pickupLocation: existing.pickupLocation,
        returnLocation: existing.returnLocation,
        selectedExtras: existing.selectedExtras,
        hotelDelivery: existing.hotelDelivery,
        client,
      });
      orderSynced = synced;

      await reservationSql.update(
        {
          ...existing,
          carId: targetCarId,
          pickupDate: start,
          returnDate: end,
          rentalDays: pricing.rentalDays,
          deliveryPrice: pricing.deliveryPrice,
          returnPrice: pricing.returnPrice,
          totalPrice: pricing.totalPrice,
          deposit: pricing.deposit ?? existing.deposit,
          priceSnapshot: pricing.snapshot || existing.priceSnapshot,
          selectedExtras: pricing.snapshot?.selectedExtras || existing.selectedExtras,
          hotelDelivery:
            pricing.snapshot?.hotelDelivery != null
              ? Boolean(pricing.snapshot.hotelDelivery)
              : existing.hotelDelivery,
        },
        client
      );

      try {
        if (prevCarId === targetCarId) {
          await bookingSync.updateRange(prevCarId, prevStart, prevEnd, start, end, client);
        } else {
          await bookingSync.moveRange(
            prevCarId,
            targetCarId,
            prevStart,
            prevEnd,
            start,
            end,
            client
          );
        }
      } catch (err) {
        if (err.code === 'OVERLAP' && force && canOverride) {
          await bookingSync.removeRange(prevCarId, prevStart, prevEnd, client);
          // Force override cleared soft conflicts in the engine; also clear overlapping
          // manual/maintenance blocks so the booking row can be written under GiST.
          await clearOverridableBlocksInRange(targetCarId, start, end, client);
          await bookingSync.addRange(targetCarId, start, end, client, { blockType: 'booking' });
        } else if (err.code === 'OVERLAP') {
          throw createHttpError('CALENDAR_CONFLICT', err.message, 409, {
            conflicts: [
              {
                code: 'BLOCK_OVERLAP',
                severity: 'block',
                message: err.message,
                overridable: true,
              },
            ],
          });
        } else {
          throw err;
        }
      }
    });

    await logAdminAction(req, {
      action: mode === 'resize' ? 'calendar.reservation.resize' : 'calendar.reservation.move',
      entityType: 'reservation',
      entityId: String(existing.id),
      metadata: {
        start,
        end,
        carId: targetCarId,
        force,
        previousFrom: prevStart,
        previousTo: prevEnd,
        previousCarId: prevCarId,
        orderSynced,
      },
    });

    emitCalendarUpdated({
      action: mode === 'resize' ? 'event_resized' : 'event_moved',
      entityType: 'reservation',
      entityId: existing.id,
    });

    const updated = await repo.findReservationById(parsed.id);
    return mapper.mapReservationEvents(updated, { includeMarkers: true });
  }

  if (parsed.type === 'blocked') {
    if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_BLOCKS)) {
      throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
    }
    const block = await repo.findBlockById(parsed.id);
    if (!block) throw createHttpError('NOT_FOUND', 'Block not found.', 404);
    const targetCarId = body.carId != null ? Number(body.carId) : Number(block.car_id);
    const conflicts = await conflictEngine.checkReservationRangeConflicts({
      carId: targetCarId,
      start,
      end,
    });
    conflictEngine.assertWritable(conflicts, { force, canOverride });
    const updated = await repo.updateManualBlock(parsed.id, {
      start,
      end,
      carId: targetCarId,
    });
    await logAdminAction(req, {
      action: 'calendar.block.move',
      entityType: 'car_date_block',
      entityId: String(parsed.id),
      metadata: { start, end, carId: targetCarId },
    });
    emitCalendarUpdated({
      action: 'event_moved',
      entityType: 'car_date_block',
      entityId: parsed.id,
    });
    return [mapper.mapBlockEvent(updated)];
  }

  if (parsed.type === 'task') {
    if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_TASKS)) {
      throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
    }
    const task = await repo.updateTaskSchedule(parsed.id, {
      startsAt: start,
      dueAt: end,
      carId: body.carId,
    });
    await logAdminAction(req, {
      action: 'calendar.task.move',
      entityType: 'calendar_task',
      entityId: task.id,
      metadata: { start, end, carId: body.carId },
    });
    emitCalendarUpdated({
      action: 'event_moved',
      entityType: 'calendar_task',
      entityId: task.id,
    });
    return [
      mapper.mapTaskEvent({
        id: task.id,
        car_id: task.carId,
        reservation_id: task.reservationId,
        task_type: task.taskType,
        title: task.title,
        notes: task.notes,
        location_text: task.locationText,
        starts_at: task.startsAt,
        due_at: task.dueAt,
        status: task.status,
        assigned_to_user_id: task.assignedToUserId,
      }),
    ];
  }

  throw createHttpError('VALIDATION_ERROR', 'Event type cannot be moved.', 422);
}

module.exports = {
  moveOrResizeEvent,
};
