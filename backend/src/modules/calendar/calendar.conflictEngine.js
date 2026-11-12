/**
 * Calendar conflict engine.
 *
 * Detects schedule conflicts for a car/date range (holds, open rentals, blocks,
 * cleaning buffer, insurance/inspection expiry, damage). Callers use
 * assertWritable to enforce hard vs soft (overridable) rules before mutating.
 */

const { CLEANING_BUFFER_HOURS } = require('./calendar.eventMapper');
// Require the '../../services/sql/reservationSqlService' module as reservationSql.
const reservationSql = require('../../services/sql/reservationSqlService');
// Destructure object properties into local variables.
const { clientQuery } = require('../../db/transaction');
// Destructure object properties into local variables.
const { HARD_UNBOOKABLE_STATUSES } = require('../../constants/carEnums');

/**
 * Build a single conflict descriptor for API / UI consumption.
 * @param {string} code Machine-readable conflict code
 * @param {'block'|'warn'} severity Whether this blocks write or is advisory
 * @param {string} message Human-readable explanation
 * @param {object} [meta] Extra fields (overridable, overlapping ids, etc.)
 */
function conflict(code, severity, message, meta = {}) {
  // Return the resulting value to the caller.
  return { code, severity, message, ...meta };
}

/**
 * Collect all conflicts for scheduling a car between start and end.
 * Soft conflicts may be overridden with force + OVERRIDE permission;
 * hard conflicts (overridable: false) always block writes.
 *
 * @param {object} opts
 * @param {string|number} opts.carId
 * @param {Date|string} opts.start
 * @param {Date|string} opts.end
 * @param {string|number|null} [opts.excludeReservationId] Skip self when resizing/moving
 * @param {string|number|null} [opts.excludeBlockId] Skip self when editing a block
 * @param {boolean} [opts.force]
 * @param {import('pg').PoolClient|null} [opts.client] Optional transaction client
 * @returns {Promise<object[]>}
 */
async function checkReservationRangeConflicts({
  // Contribute this line to the enclosing declaration or statement.
  carId,
  // Contribute this line to the enclosing declaration or statement.
  start,
  // Contribute this line to the enclosing declaration or statement.
  end,
  // Update excludeReservationId with the right-hand side value.
  excludeReservationId = null,
  // Update excludeBlockId with the right-hand side value.
  excludeBlockId = null,
  // Update force with the right-hand side value.
  force = false,
  // Update client with the right-hand side value.
  client = null,
// Continue the surrounding logic with this statement.
}) {
  // Create the conflicts constant.
  const conflicts = [];
  // Create the car id num constant.
  const carIdNum = Number(carId);
  // Create the excluded block id constant.
  const excludedBlockId = Number(excludeBlockId);
  // Create the has exclude block constant.
  const hasExcludeBlock =
    // Call Number.isInteger to perform this step.
    Number.isInteger(excludedBlockId) && excludedBlockId > 0;

  // Step 1: load car row — missing car is a hard, non-overridable blocker.
  const carResult = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, status, insurance_expiry, technical_inspection_expiry, name
    FROM cars WHERE id = $1 AND is_deleted = FALSE LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carIdNum]
  );
  // Create the car constant.
  const car = carResult.rows[0];
  // Evaluate the condition and enter the branch when it is true.
  if (!car) {
    // Call conflicts.push to perform this step.
    conflicts.push(conflict('CAR_NOT_FOUND', 'block', 'Car not found.', { overridable: false }));
    // Return the resulting value to the caller.
    return conflicts;
  }

  // Step 2: fleet status — damaged/inactive/etc. block unless caller forces with override.
  if (HARD_UNBOOKABLE_STATUSES.includes(car.status)) {
    // Call conflicts.push to perform this step.
    conflicts.push(
      // Call conflict to perform this step.
      conflict(
        // Supply the literal value used by the enclosing expression.
        'CAR_STATUS_BLOCK',
        // Supply the literal value used by the enclosing expression.
        'block',
        // Continue the surrounding logic with this statement.
        `Car is ${car.status} and cannot be scheduled without override.`,
        // Contribute this line to the enclosing declaration or statement.
        { overridable: true, carStatus: car.status }
      )
    );
  }

  // Step 3: active payment holds still occupy the car even if not yet confirmed.
  const hold = await reservationSql.findOverlappingHold(
    {
      // Provide the car id field value.
      carId: carIdNum,
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
  if (hold && String(hold.id) !== String(excludeReservationId || '')) {
    // Call conflicts.push to perform this step.
    conflicts.push(
      // Call conflict to perform this step.
      conflict('HOLD_OVERLAP', 'block', 'Overlaps an active payment hold.', {
        // Provide the overridable field value.
        overridable: false,
        // Provide the overlapping reservation id field value.
        overlappingReservationId: String(hold.id),
      })
    );
  }

  // Step 4: physically out cars cannot accept another booking until returned.
  const openPhysical = await reservationSql.findOpenPhysicalRental(carIdNum, client, {
    // Contribute this line to the enclosing declaration or statement.
    excludeReservationId,
  });
  // Evaluate the condition and enter the branch when it is true.
  if (openPhysical) {
    // Call conflicts.push to perform this step.
    conflicts.push(
      // Call conflict to perform this step.
      conflict(
        // Supply the literal value used by the enclosing expression.
        'OPEN_PHYSICAL_RENTAL',
        // Supply the literal value used by the enclosing expression.
        'block',
        // Continue the surrounding logic with this statement.
        'Car has an open rental (picked up / active) and cannot be scheduled until returned.',
        {
          // Provide the overridable field value.
          overridable: false,
          // Provide the overlapping reservation id field value.
          overlappingReservationId: String(openPhysical.id),
        }
      )
    );
  }

  // Step 5: overlapping manual date blocks (maintenance, owner use, etc.).
  const blockParams = [carIdNum, start, end];
  // Initialize the mutable exclude block sql variable.
  let excludeBlockSql = '';
  // Evaluate the condition and enter the branch when it is true.
  if (hasExcludeBlock) {
    // When editing an existing block, skip that row so it does not conflict with itself.
    blockParams.push(excludedBlockId);
    // Update excludeBlockSql with the right-hand side value.
    excludeBlockSql = ` AND id <> $${blockParams.length}`;
  }
  // Create the block result constant.
  const blockResult = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, block_type, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = $1
      AND start_date < $3
      AND end_date > $2
      ${excludeBlockSql}
    LIMIT 5
    `,
    // Reference the identifier used by the enclosing expression.
    blockParams
  );
  // Iterate using the loop initializer, condition, and step.
  for (const row of blockResult.rows) {
    // Call conflicts.push to perform this step.
    conflicts.push(
      // Call conflict to perform this step.
      conflict('BLOCK_OVERLAP', 'block', `Overlaps a ${row.block_type} date block.`, {
        // Provide the overridable field value.
        overridable: true,
        // Provide the block id field value.
        blockId: String(row.id),
        // Provide the block type field value.
        blockType: row.block_type,
      })
    );
  }

  // Step 6: sequence vs next pickup after our proposed return (resize/move safety).
  const nextPickup = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, pickup_date
    FROM reservations
    WHERE car_id = $1
      AND status NOT IN ('cancelled','expired','refunded','no_show','completed')
      AND pickup_date >= $2
      ${excludeReservationId ? 'AND id <> $3' : ''}
    ORDER BY pickup_date ASC
    LIMIT 1
    `,
    // Reference the identifier used by the enclosing expression.
    excludeReservationId
      // Continue the surrounding logic with this statement.
      ? [carIdNum, end, Number(excludeReservationId)]
      // Contribute this line to the enclosing declaration or statement.
      : [carIdNum, end]
  );
  // Evaluate the condition and enter the branch when it is true.
  if (nextPickup.rows[0]) {
    // Create the next start constant.
    const nextStart = new Date(nextPickup.rows[0].pickup_date).getTime();
    // Create the our end constant.
    const ourEnd = new Date(end).getTime();
    // Create the buffer ms constant.
    const bufferMs = CLEANING_BUFFER_HOURS * 60 * 60 * 1000;
    // Evaluate the condition and enter the branch when it is true.
    if (ourEnd > nextStart) {
      // Hard overlap with the following booking's start.
      conflicts.push(
        // Call conflict to perform this step.
        conflict('RETURN_AFTER_NEXT_PICKUP', 'block', 'Return is after the next pickup.', {
          // Provide the overridable field value.
          overridable: true,
          // Provide the next reservation id field value.
          nextReservationId: String(nextPickup.rows[0].id),
        })
      );
    // Continue the surrounding logic with this statement.
    } else if (nextStart - ourEnd < bufferMs) {
      // Soft: turnaround window between return and next pickup is too short.
      conflicts.push(
        // Call conflict to perform this step.
        conflict(
          // Supply the literal value used by the enclosing expression.
          'CLEANING_BUFFER',
          // Supply the literal value used by the enclosing expression.
          'warn',
          // Continue the surrounding logic with this statement.
          `Less than ${CLEANING_BUFFER_HOURS}h between return and next pickup.`,
          // Continue the surrounding logic with this statement.
          { overridable: true, nextReservationId: String(nextPickup.rows[0].id) }
        )
      );
    }
  }

  // Step 7: insurance / technical inspection must cover the rental window.
  const startDate = new Date(start);
  // Create the end date constant.
  const endDate = new Date(end);
  // Evaluate the condition and enter the branch when it is true.
  if (car.insurance_expiry) {
    // Create the exp constant.
    const exp = new Date(car.insurance_expiry);
    // Evaluate the condition and enter the branch when it is true.
    if (exp < startDate) {
      // Call conflicts.push to perform this step.
      conflicts.push(
        // Call conflict to perform this step.
        conflict('INSURANCE_EXPIRED', 'block', 'Insurance expired before rental start.', {
          // Provide the overridable field value.
          overridable: true,
        })
      );
    // Continue the surrounding logic with this statement.
    } else if (exp <= endDate) {
      // Call conflicts.push to perform this step.
      conflicts.push(
        // Call conflict to perform this step.
        conflict('INSURANCE_EXPIRES_DURING', 'warn', 'Insurance expires during rental.', {
          // Provide the overridable field value.
          overridable: true,
        })
      );
    }
  }
  // Evaluate the condition and enter the branch when it is true.
  if (car.technical_inspection_expiry) {
    // Create the exp constant.
    const exp = new Date(car.technical_inspection_expiry);
    // Evaluate the condition and enter the branch when it is true.
    if (exp < startDate) {
      // Call conflicts.push to perform this step.
      conflicts.push(
        // Call conflict to perform this step.
        conflict('INSPECTION_EXPIRED', 'block', 'Technical inspection expired before start.', {
          // Provide the overridable field value.
          overridable: true,
        })
      );
    // Continue the surrounding logic with this statement.
    } else if (exp <= endDate) {
      // Call conflicts.push to perform this step.
      conflicts.push(
        // Call conflict to perform this step.
        conflict('INSPECTION_EXPIRES_DURING', 'warn', 'Technical inspection expires during rental.', {
          // Provide the overridable field value.
          overridable: true,
        })
      );
    }
  }

  // Step 8: unresolved damage report only blocks when the car status is also damaged.
  const damage = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id FROM car_damage_reports
    WHERE car_id = $1 AND status = 'unresolved'
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [carIdNum]
  );
  // Evaluate the condition and enter the branch when it is true.
  if (damage.rows[0] && car.status === 'damaged') {
    // Call conflicts.push to perform this step.
    conflicts.push(
      // Call conflict to perform this step.
      conflict('DAMAGED_ACTIVE', 'block', 'Damaged car with unresolved report.', {
        // Provide the overridable field value.
        overridable: true,
      })
    );
  }

  // Return the resulting value to the caller.
  return conflicts;
}

/**
 * Throw CALENDAR_CONFLICT (409) when write is not allowed.
 * Hard (non-overridable) blockers always fail. Soft blockers require
 * force && canOverride. Warns alone do not fail unless force without override
 * permission (reserved path below).
 *
 * @param {object[]} conflicts
 * @param {{ force?: boolean, canOverride?: boolean }} [opts]
 * @returns {{ conflicts: object[], forced: boolean }}
 */
function assertWritable(conflicts, { force = false, canOverride = false } = {}) {
  // Separate hard blockers (never override) from soft blockers (need force+permission).
  const blockers = conflicts.filter((c) => c.severity === 'block');
  // Create the hard constant.
  const hard = blockers.filter((c) => c.overridable === false);
  // Evaluate the condition and enter the branch when it is true.
  if (hard.length > 0) {
    // Create the err constant.
    const err = new Error(hard[0].message);
    // Update err.code with the right-hand side value.
    err.code = 'CALENDAR_CONFLICT';
    // Update err.status with the right-hand side value.
    err.status = 409;
    // Update err.conflicts with the right-hand side value.
    err.conflicts = conflicts;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Create the soft blocks constant.
  const softBlocks = blockers.filter((c) => c.overridable !== false);
  // Create the warns constant.
  const warns = conflicts.filter((c) => c.severity === 'warn');

  // Soft blocks: allow only when caller both forces and has OVERRIDE permission.
  if (softBlocks.length > 0 && !(force && canOverride)) {
    // Create the err constant.
    const err = new Error(softBlocks[0].message);
    // Update err.code with the right-hand side value.
    err.code = 'CALENDAR_CONFLICT';
    // Update err.status with the right-hand side value.
    err.status = 409;
    // Update err.conflicts with the right-hand side value.
    err.conflicts = conflicts;
    // Throw an error to stop the current control flow.
    throw err;
  }

  // Reserved: force without override permission remains blocked on warn-level conflicts.
  if (warns.length > 0 && force && !canOverride) {
    // Intentionally no throw yet — reserved path for future stricter warn enforcement.
  }

  // Return the resulting value to the caller.
  return { conflicts, forced: Boolean(force && canOverride) };
}

/**
 * Read-only conflict collection (no force semantics). Used for preview/UI.
 * @param {object} opts
 * @returns {Promise<object[]>}
 */
async function collectRangeConflictsForRead({ carId, start, end, excludeReservationId = null }) {
  // Return the resulting value to the caller.
  return checkReservationRangeConflicts({
    // Contribute this line to the enclosing declaration or statement.
    carId,
    // Contribute this line to the enclosing declaration or statement.
    start,
    // Contribute this line to the enclosing declaration or statement.
    end,
    // Contribute this line to the enclosing declaration or statement.
    excludeReservationId,
    // Provide the force field value.
    force: false,
  });
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  checkReservationRangeConflicts,
  // Contribute this line to the enclosing declaration or statement.
  assertWritable,
  // Contribute this line to the enclosing declaration or statement.
  collectRangeConflictsForRead,
};
