/**
 * Calendar conflict engine.
 *
 * Detects schedule conflicts for a car/date range (holds, open rentals, blocks,
 * cleaning buffer, insurance/inspection expiry, damage). Callers use
 * assertWritable to enforce hard vs soft (overridable) rules before mutating.
 */

const { CLEANING_BUFFER_HOURS } = require('./calendar.eventMapper');
const reservationSql = require('../../services/sql/reservationSqlService');
const { clientQuery } = require('../../db/transaction');
const { HARD_UNBOOKABLE_STATUSES } = require('../../constants/carEnums');

/**
 * Build a single conflict descriptor for API / UI consumption.
 * @param {string} code Machine-readable conflict code
 * @param {'block'|'warn'} severity Whether this blocks write or is advisory
 * @param {string} message Human-readable explanation
 * @param {object} [meta] Extra fields (overridable, overlapping ids, etc.)
 */
function conflict(code, severity, message, meta = {}) {
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
  carId,
  start,
  end,
  excludeReservationId = null,
  excludeBlockId = null,
  force = false,
  client = null,
}) {
  const conflicts = [];
  const carIdNum = Number(carId);
  const excludedBlockId = Number(excludeBlockId);
  const hasExcludeBlock =
    Number.isInteger(excludedBlockId) && excludedBlockId > 0;

  // Step 1: load car row — missing car is a hard, non-overridable blocker.
  const carResult = await clientQuery(
    client,
    `
    SELECT id, status, insurance_expiry, technical_inspection_expiry, name
    FROM cars WHERE id = $1 AND is_deleted = FALSE LIMIT 1
    `,
    [carIdNum]
  );
  const car = carResult.rows[0];
  if (!car) {
    conflicts.push(conflict('CAR_NOT_FOUND', 'block', 'Car not found.', { overridable: false }));
    return conflicts;
  }

  // Step 2: fleet status — damaged/inactive/etc. block unless caller forces with override.
  if (HARD_UNBOOKABLE_STATUSES.includes(car.status)) {
    conflicts.push(
      conflict(
        'CAR_STATUS_BLOCK',
        'block',
        `Car is ${car.status} and cannot be scheduled without override.`,
        { overridable: true, carStatus: car.status }
      )
    );
  }

  // Step 3: active payment holds still occupy the car even if not yet confirmed.
  const hold = await reservationSql.findOverlappingHold(
    {
      carId: carIdNum,
      startDate: start,
      endDate: end,
      now: new Date(),
      excludeReservationId,
    },
    client
  );
  if (hold && String(hold.id) !== String(excludeReservationId || '')) {
    conflicts.push(
      conflict('HOLD_OVERLAP', 'block', 'Overlaps an active payment hold.', {
        overridable: false,
        overlappingReservationId: String(hold.id),
      })
    );
  }

  // Step 4: physically out cars cannot accept another booking until returned.
  const openPhysical = await reservationSql.findOpenPhysicalRental(carIdNum, client, {
    excludeReservationId,
  });
  if (openPhysical) {
    conflicts.push(
      conflict(
        'OPEN_PHYSICAL_RENTAL',
        'block',
        'Car has an open rental (picked up / active) and cannot be scheduled until returned.',
        {
          overridable: false,
          overlappingReservationId: String(openPhysical.id),
        }
      )
    );
  }

  // Step 5: overlapping manual date blocks (maintenance, owner use, etc.).
  const blockParams = [carIdNum, start, end];
  let excludeBlockSql = '';
  if (hasExcludeBlock) {
    // When editing an existing block, skip that row so it does not conflict with itself.
    blockParams.push(excludedBlockId);
    excludeBlockSql = ` AND id <> $${blockParams.length}`;
  }
  const blockResult = await clientQuery(
    client,
    `
    SELECT id, block_type, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = $1
      AND start_date < $3
      AND end_date > $2
      ${excludeBlockSql}
    LIMIT 5
    `,
    blockParams
  );
  for (const row of blockResult.rows) {
    conflicts.push(
      conflict('BLOCK_OVERLAP', 'block', `Overlaps a ${row.block_type} date block.`, {
        overridable: true,
        blockId: String(row.id),
        blockType: row.block_type,
      })
    );
  }

  // Step 6: sequence vs next pickup after our proposed return (resize/move safety).
  const nextPickup = await clientQuery(
    client,
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
    excludeReservationId
      ? [carIdNum, end, Number(excludeReservationId)]
      : [carIdNum, end]
  );
  if (nextPickup.rows[0]) {
    const nextStart = new Date(nextPickup.rows[0].pickup_date).getTime();
    const ourEnd = new Date(end).getTime();
    const bufferMs = CLEANING_BUFFER_HOURS * 60 * 60 * 1000;
    if (ourEnd > nextStart) {
      // Hard overlap with the following booking's start.
      conflicts.push(
        conflict('RETURN_AFTER_NEXT_PICKUP', 'block', 'Return is after the next pickup.', {
          overridable: true,
          nextReservationId: String(nextPickup.rows[0].id),
        })
      );
    } else if (nextStart - ourEnd < bufferMs) {
      // Soft: turnaround window between return and next pickup is too short.
      conflicts.push(
        conflict(
          'CLEANING_BUFFER',
          'warn',
          `Less than ${CLEANING_BUFFER_HOURS}h between return and next pickup.`,
          { overridable: true, nextReservationId: String(nextPickup.rows[0].id) }
        )
      );
    }
  }

  // Step 7: insurance / technical inspection must cover the rental window.
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (car.insurance_expiry) {
    const exp = new Date(car.insurance_expiry);
    if (exp < startDate) {
      conflicts.push(
        conflict('INSURANCE_EXPIRED', 'block', 'Insurance expired before rental start.', {
          overridable: true,
        })
      );
    } else if (exp <= endDate) {
      conflicts.push(
        conflict('INSURANCE_EXPIRES_DURING', 'warn', 'Insurance expires during rental.', {
          overridable: true,
        })
      );
    }
  }
  if (car.technical_inspection_expiry) {
    const exp = new Date(car.technical_inspection_expiry);
    if (exp < startDate) {
      conflicts.push(
        conflict('INSPECTION_EXPIRED', 'block', 'Technical inspection expired before start.', {
          overridable: true,
        })
      );
    } else if (exp <= endDate) {
      conflicts.push(
        conflict('INSPECTION_EXPIRES_DURING', 'warn', 'Technical inspection expires during rental.', {
          overridable: true,
        })
      );
    }
  }

  // Step 8: unresolved damage report only blocks when the car status is also damaged.
  const damage = await clientQuery(
    client,
    `
    SELECT id FROM car_damage_reports
    WHERE car_id = $1 AND status = 'unresolved'
    LIMIT 1
    `,
    [carIdNum]
  );
  if (damage.rows[0] && car.status === 'damaged') {
    conflicts.push(
      conflict('DAMAGED_ACTIVE', 'block', 'Damaged car with unresolved report.', {
        overridable: true,
      })
    );
  }

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
  const hard = blockers.filter((c) => c.overridable === false);
  if (hard.length > 0) {
    const err = new Error(hard[0].message);
    err.code = 'CALENDAR_CONFLICT';
    err.status = 409;
    err.conflicts = conflicts;
    throw err;
  }

  const softBlocks = blockers.filter((c) => c.overridable !== false);
  const warns = conflicts.filter((c) => c.severity === 'warn');

  // Soft blocks: allow only when caller both forces and has OVERRIDE permission.
  if (softBlocks.length > 0 && !(force && canOverride)) {
    const err = new Error(softBlocks[0].message);
    err.code = 'CALENDAR_CONFLICT';
    err.status = 409;
    err.conflicts = conflicts;
    throw err;
  }

  // Reserved: force without override permission remains blocked on warn-level conflicts.
  if (warns.length > 0 && force && !canOverride) {
    // Intentionally no throw yet — reserved path for future stricter warn enforcement.
  }

  return { conflicts, forced: Boolean(force && canOverride) };
}

/**
 * Read-only conflict collection (no force semantics). Used for preview/UI.
 * @param {object} opts
 * @returns {Promise<object[]>}
 */
async function collectRangeConflictsForRead({ carId, start, end, excludeReservationId = null }) {
  return checkReservationRangeConflicts({
    carId,
    start,
    end,
    excludeReservationId,
    force: false,
  });
}

module.exports = {
  checkReservationRangeConflicts,
  assertWritable,
  collectRangeConflictsForRead,
};
