/**
 * Move / resize calendar events (reservations, blocks, tasks).
 *
 * Reservations update pricing + booking-sync ranges under car advisory locks.
 * Force+OVERRIDE clears soft block overlaps so GiST booking rows can be written.
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
// Require the '../../services/sql/bookingSyncSqlService' module as bookingSync.
const bookingSync = require('../../services/sql/bookingSyncSqlService');
// Require the '../../services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../services/sql/reservationSqlService');
// Destructure object properties into local variables.
const { runWithTransaction, clientQuery, acquireCarAdvisoryLocks } = require('../../db/transaction');
// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  syncLinkedOrderAfterReservationMove,
// Continue the surrounding logic with this statement.
} = require('../../services/admin/order/orderReservationSync');
// Destructure object properties into local variables.
const { createHttpError, emitCalendarUpdated } = require('./calendar.shared');

/** Soft calendar blocks that force-override is allowed to clear for a reservation move/resize. */
async function clearOverridableBlocksInRange(carId, start, end, client) {
  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1
      AND block_type IN ('manual', 'maintenance', 'other')
      AND start_date < $3
      AND end_date > $2
    `,
    // Continue the surrounding logic with this statement.
    [Number(carId), start, end]
  );
}

/**
 * Hard-fail if the target range overlaps an active hold or open physical rental.
 * Re-checked inside the transaction after advisory locks.
 */
async function assertNoHoldOrOpenPhysicalRental({
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  start,
  // Contribute this line to the enclosing declaration or statement.
  end,
  // Contribute this line to the enclosing declaration or statement.
  excludeReservationId,
  // Contribute this line to the enclosing declaration or statement.
  client,
// Continue the surrounding logic with this statement.
}) {
  // Create the hold constant.
  const hold = await reservationSql.findOverlappingHold(
    {
      // Contribute this line to the enclosing declaration or statement.
      carId,
      // Provide the start date field value.
      startDate: start,
      // Provide the end date field value.
      endDate: end,
      // Provide the now field value.
      now: new Date(),
      // Contribute this line to the enclosing declaration or statement.
      excludeReservationId,
    },
    // Reference the identifier used by the enclosing expression.
    client
  );
  // Evaluate the condition and enter the branch when it is true.
  if (hold) {
    // Throw an error to stop the current control flow.
    throw createHttpError('CALENDAR_CONFLICT', 'Overlaps an active payment hold.', 409, {
      // Provide the conflicts field value.
      conflicts: [
        {
          // Provide the code field value.
          code: 'HOLD_OVERLAP',
          // Provide the severity field value.
          severity: 'block',
          // Provide the message field value.
          message: 'Overlaps an active payment hold.',
          // Provide the overridable field value.
          overridable: false,
          // Provide the overlapping reservation id field value.
          overlappingReservationId: String(hold.id),
        },
      ],
    });
  }

  // Create the open physical constant.
  const openPhysical = await reservationSql.findOpenPhysicalRental(carId, client, {
    // Contribute this line to the enclosing declaration or statement.
    excludeReservationId,
  });
  // Evaluate the condition and enter the branch when it is true.
  if (openPhysical) {
    // Throw an error to stop the current control flow.
    throw createHttpError(
      // Supply the literal value used by the enclosing expression.
      'CALENDAR_CONFLICT',
      // Continue the surrounding logic with this statement.
      'Car has an open rental (picked up / active) and cannot be scheduled until returned.',
      // Supply the literal value used by the enclosing expression.
      409,
      {
        // Provide the conflicts field value.
        conflicts: [
          {
            // Provide the code field value.
            code: 'OPEN_PHYSICAL_RENTAL',
            // Provide the severity field value.
            severity: 'block',
            // Provide the message field value.
            message:
              // Continue the surrounding logic with this statement.
              'Car has an open rental (picked up / active) and cannot be scheduled until returned.',
            // Provide the overridable field value.
            overridable: false,
            // Provide the overlapping reservation id field value.
            overlappingReservationId: String(openPhysical.id),
          },
        ],
      }
    );
  }
}

/**
 * Move or resize a calendar event by parsed `type:id`.
 * @param {object} access
 * @param {string} eventId
 * @param {object} body start, end, optional carId/force
 * @param {object} req Express request (audit)
 * @param {'move'|'resize'} mode
 * @returns {Promise<object[]>} Updated mapped events
 */
async function moveOrResizeEvent(access, eventId, body, req, mode) {
  // Parse composite calendar id: reservation|blocked|task : numeric id.
  const parsed = mapper.parseEventId(eventId);
  // Evaluate the condition and enter the branch when it is true.
  if (!parsed) throw createHttpError('VALIDATION_ERROR', 'Invalid event id.', 422);

  // Create the force constant.
  const force = Boolean(body.force);
  // Create the can override constant.
  const canOverride = rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.OVERRIDE);
  // Create the start constant.
  const start = new Date(body.start);
  // Create the end constant.
  const end = new Date(body.end);

  // --- Reservation move / resize ---
  if (parsed.type === 'reservation') {
    // Create the perm constant.
    const perm = mode === 'resize' ? CALENDAR_PERMISSIONS.RESIZE : CALENDAR_PERMISSIONS.MOVE;
    // Evaluate the condition and enter the branch when it is true.
    if (!rbacService.userHasPermission(access, perm)) {
      // Throw an error to stop the current control flow.
      throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
    }
    // Evaluate the condition and enter the branch when it is true.
    if (!(start < end)) {
      // Throw an error to stop the current control flow.
      throw createHttpError('VALIDATION_ERROR', 'Invalid range.', 422);
    }

    // Create the existing constant.
    const existing = await reservationSql.findById(parsed.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!existing) throw createHttpError('NOT_FOUND', 'Reservation not found.', 404);

    // Optional car change on move; default to current car.
    const targetCarId = body.carId != null ? Number(body.carId) : Number(
      // Contribute this line to the enclosing declaration or statement.
      existing.carId?.id || existing.carId
    );
    // Create the conflicts constant.
    const conflicts = await conflictEngine.checkReservationRangeConflicts({
      // Provide the car id field value.
      carId: targetCarId,
      // Contribute this line to the enclosing declaration or statement.
      start,
      // Contribute this line to the enclosing declaration or statement.
      end,
      // Provide the exclude reservation id field value.
      excludeReservationId: existing.id,
    });
    // Ignore booking-synced blocks (they represent this reservation's own range).
    const writableConflicts = conflicts.filter(
      // Continue the surrounding logic with this statement.
      (c) => !(c.code === 'BLOCK_OVERLAP' && c.blockType === 'booking')
    );
    // Call conflictEngine.assertWritable to perform this step.
    conflictEngine.assertWritable(writableConflicts, { force, canOverride });

    // Create the prev start constant.
    const prevStart = existing.pickupDate;
    // Create the prev end constant.
    const prevEnd = existing.returnDate;
    // Create the prev car id constant.
    const prevCarId = Number(existing.carId?.id || existing.carId);
    // Initialize the mutable order synced variable.
    let orderSynced = false;

    // Wait until the asynchronous operation resolves.
    await runWithTransaction(async (client) => {
      // Lock previous + target cars before re-checking hard conflicts.
      await acquireCarAdvisoryLocks(client, [prevCarId, targetCarId]);
      // Wait until the asynchronous operation resolves.
      await assertNoHoldOrOpenPhysicalRental({
        // Provide the car id field value.
        carId: targetCarId,
        // Contribute this line to the enclosing declaration or statement.
        start,
        // Contribute this line to the enclosing declaration or statement.
        end,
        // Provide the exclude reservation id field value.
        excludeReservationId: existing.id,
        // Contribute this line to the enclosing declaration or statement.
        client,
      });

      // Reprice linked order for the new range/car, then persist reservation fields.
      const { pricing, orderSynced: synced } = await syncLinkedOrderAfterReservationMove({
        // Provide the reservation id field value.
        reservationId: existing.id,
        // Provide the car id field value.
        carId: targetCarId,
        // Contribute this line to the enclosing declaration or statement.
        start,
        // Contribute this line to the enclosing declaration or statement.
        end,
        // Provide the pickup time field value.
        pickupTime: existing.pickupTime,
        // Provide the return time field value.
        returnTime: existing.returnTime,
        // Provide the pickup location field value.
        pickupLocation: existing.pickupLocation,
        // Provide the return location field value.
        returnLocation: existing.returnLocation,
        // Provide the selected extras field value.
        selectedExtras: existing.selectedExtras,
        // Provide the hotel delivery field value.
        hotelDelivery: existing.hotelDelivery,
        // Contribute this line to the enclosing declaration or statement.
        client,
      });
      // Update orderSynced with the right-hand side value.
      orderSynced = synced;

      // Wait until the asynchronous operation resolves.
      await reservationSql.update(
        {
          // Spread existing into the surrounding structure.
          ...existing,
          // Provide the car id field value.
          carId: targetCarId,
          // Provide the pickup date field value.
          pickupDate: start,
          // Provide the return date field value.
          returnDate: end,
          // Provide the rental days field value.
          rentalDays: pricing.rentalDays,
          // Provide the delivery price field value.
          deliveryPrice: pricing.deliveryPrice,
          // Provide the return price field value.
          returnPrice: pricing.returnPrice,
          // Provide the total price field value.
          totalPrice: pricing.totalPrice,
          // Provide the deposit field value.
          deposit: pricing.deposit ?? existing.deposit,
          // Provide the price snapshot field value.
          priceSnapshot: pricing.snapshot || existing.priceSnapshot,
          // Provide the selected extras field value.
          selectedExtras: pricing.snapshot?.selectedExtras || existing.selectedExtras,
          // Provide the hotel delivery field value.
          hotelDelivery:
            // Continue the surrounding logic with this statement.
            pricing.snapshot?.hotelDelivery != null
              // Continue the surrounding logic with this statement.
              ? Boolean(pricing.snapshot.hotelDelivery)
              // Contribute this line to the enclosing declaration or statement.
              : existing.hotelDelivery,
        },
        // Reference the identifier used by the enclosing expression.
        client
      );

      // Sync GiST booking rows; same-car uses updateRange, cross-car uses moveRange.
      try {
        // Evaluate the condition and enter the branch when it is true.
        if (prevCarId === targetCarId) {
          // Wait until the asynchronous operation resolves.
          await bookingSync.updateRange(prevCarId, prevStart, prevEnd, start, end, client);
        // Contribute this line to the enclosing declaration or statement.
        } else {
          // Wait until the asynchronous operation resolves.
          await bookingSync.moveRange(
            // Contribute this line to the enclosing declaration or statement.
            prevCarId,
            // Contribute this line to the enclosing declaration or statement.
            targetCarId,
            // Contribute this line to the enclosing declaration or statement.
            prevStart,
            // Contribute this line to the enclosing declaration or statement.
            prevEnd,
            // Contribute this line to the enclosing declaration or statement.
            start,
            // Contribute this line to the enclosing declaration or statement.
            end,
            // Reference the identifier used by the enclosing expression.
            client
          );
        }
      // Continue the surrounding logic with this statement.
      } catch (err) {
        // Evaluate the condition and enter the branch when it is true.
        if (err.code === 'OVERLAP' && force && canOverride) {
          // Force path: drop old booking row, clear soft blocks, write new booking range.
          await bookingSync.removeRange(prevCarId, prevStart, prevEnd, client);
          // Wait until the asynchronous operation resolves.
          await clearOverridableBlocksInRange(targetCarId, start, end, client);
          // Wait until the asynchronous operation resolves.
          await bookingSync.addRange(targetCarId, start, end, client, { blockType: 'booking' });
        // Continue the surrounding logic with this statement.
        } else if (err.code === 'OVERLAP') {
          // Soft GiST overlap without override permission → 409.
          throw createHttpError('CALENDAR_CONFLICT', err.message, 409, {
            // Provide the conflicts field value.
            conflicts: [
              {
                // Provide the code field value.
                code: 'BLOCK_OVERLAP',
                // Provide the severity field value.
                severity: 'block',
                // Provide the message field value.
                message: err.message,
                // Provide the overridable field value.
                overridable: true,
              },
            ],
          });
        // Contribute this line to the enclosing declaration or statement.
        } else {
          // Throw an error to stop the current control flow.
          throw err;
        }
      }
    });

    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: mode === 'resize' ? 'calendar.reservation.resize' : 'calendar.reservation.move',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: String(existing.id),
      // Provide the metadata field value.
      metadata: {
        // Contribute this line to the enclosing declaration or statement.
        start,
        // Contribute this line to the enclosing declaration or statement.
        end,
        // Provide the car id field value.
        carId: targetCarId,
        // Contribute this line to the enclosing declaration or statement.
        force,
        // Provide the previous from field value.
        previousFrom: prevStart,
        // Provide the previous to field value.
        previousTo: prevEnd,
        // Provide the previous car id field value.
        previousCarId: prevCarId,
        // Contribute this line to the enclosing declaration or statement.
        orderSynced,
      },
    });

    // Call emitCalendarUpdated to perform this step.
    emitCalendarUpdated({
      // Provide the action field value.
      action: mode === 'resize' ? 'event_resized' : 'event_moved',
      // Provide the entity type field value.
      entityType: 'reservation',
      // Provide the entity id field value.
      entityId: existing.id,
    });

    // Create the updated constant.
    const updated = await repo.findReservationById(parsed.id);
    // Return the resulting value to the caller.
    return mapper.mapReservationEvents(updated, { includeMarkers: true });
  }

  // --- Manual / maintenance block move ---
  if (parsed.type === 'blocked') {
    // Evaluate the condition and enter the branch when it is true.
    if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_BLOCKS)) {
      // Throw an error to stop the current control flow.
      throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
    }
    // Create the block constant.
    const block = await repo.findBlockById(parsed.id);
    // Evaluate the condition and enter the branch when it is true.
    if (!block) throw createHttpError('NOT_FOUND', 'Block not found.', 404);
    // Create the target car id constant.
    const targetCarId = body.carId != null ? Number(body.carId) : Number(block.car_id);

    // Create the updated constant.
    const updated = await runWithTransaction(async (client) => {
      // Wait until the asynchronous operation resolves.
      await acquireCarAdvisoryLocks(client, [block.car_id, targetCarId]);

      // Exclude this block from overlap so resizing itself is allowed.
      const conflicts = await conflictEngine.checkReservationRangeConflicts({
        // Provide the car id field value.
        carId: targetCarId,
        // Contribute this line to the enclosing declaration or statement.
        start,
        // Contribute this line to the enclosing declaration or statement.
        end,
        // Provide the exclude block id field value.
        excludeBlockId: parsed.id,
        // Contribute this line to the enclosing declaration or statement.
        client,
      });
      // Call conflictEngine.assertWritable to perform this step.
      conflictEngine.assertWritable(conflicts, { force, canOverride });

      // Return the resulting value to the caller.
      return repo.updateManualBlock(
        // Contribute this line to the enclosing declaration or statement.
        parsed.id,
        {
          // Contribute this line to the enclosing declaration or statement.
          start,
          // Contribute this line to the enclosing declaration or statement.
          end,
          // Provide the car id field value.
          carId: targetCarId,
        },
        // Reference the identifier used by the enclosing expression.
        client
      );
    });

    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'calendar.block.move',
      // Provide the entity type field value.
      entityType: 'car_date_block',
      // Provide the entity id field value.
      entityId: String(parsed.id),
      // Provide the metadata field value.
      metadata: { start, end, carId: targetCarId },
    });
    // Call emitCalendarUpdated to perform this step.
    emitCalendarUpdated({
      // Provide the action field value.
      action: 'event_moved',
      // Provide the entity type field value.
      entityType: 'car_date_block',
      // Provide the entity id field value.
      entityId: parsed.id,
    });
    // Return the resulting value to the caller.
    return [mapper.mapBlockEvent(updated)];
  }

  // --- Ops task schedule move (startsAt/dueAt + optional car) ---
  if (parsed.type === 'task') {
    // Evaluate the condition and enter the branch when it is true.
    if (!rbacService.userHasPermission(access, CALENDAR_PERMISSIONS.CREATE_TASKS)) {
      // Throw an error to stop the current control flow.
      throw createHttpError('FORBIDDEN', 'Not allowed.', 403);
    }
    // Create the task constant.
    const task = await repo.updateTaskSchedule(parsed.id, {
      // Provide the starts at field value.
      startsAt: start,
      // Provide the due at field value.
      dueAt: end,
      // Provide the car id field value.
      carId: body.carId,
    });
    // Wait until the asynchronous operation resolves.
    await logAdminAction(req, {
      // Provide the action field value.
      action: 'calendar.task.move',
      // Provide the entity type field value.
      entityType: 'calendar_task',
      // Provide the entity id field value.
      entityId: task.id,
      // Provide the metadata field value.
      metadata: { start, end, carId: body.carId },
    });
    // Call emitCalendarUpdated to perform this step.
    emitCalendarUpdated({
      // Provide the action field value.
      action: 'event_moved',
      // Provide the entity type field value.
      entityType: 'calendar_task',
      // Provide the entity id field value.
      entityId: task.id,
    });
    // Return the resulting value to the caller.
    return [
      // Call mapper.mapTaskEvent to perform this step.
      mapper.mapTaskEvent({
        // Provide the id field value.
        id: task.id,
        // Provide the car id field value.
        car_id: task.carId,
        // Provide the reservation id field value.
        reservation_id: task.reservationId,
        // Provide the task type field value.
        task_type: task.taskType,
        // Provide the title field value.
        title: task.title,
        // Provide the notes field value.
        notes: task.notes,
        // Provide the location text field value.
        location_text: task.locationText,
        // Provide the starts at field value.
        starts_at: task.startsAt,
        // Provide the due at field value.
        due_at: task.dueAt,
        // Provide the status field value.
        status: task.status,
        // Provide the assigned to user id field value.
        assigned_to_user_id: task.assignedToUserId,
      }),
    ];
  }

  // Throw an error to stop the current control flow.
  throw createHttpError('VALIDATION_ERROR', 'Event type cannot be moved.', 422);
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  moveOrResizeEvent,
};
