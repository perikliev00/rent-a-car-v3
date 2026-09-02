const { CLEANING_BUFFER_HOURS } = require('./calendar.eventMapper');
const reservationSql = require('../../services/sql/reservationSqlService');
const { clientQuery } = require('../../db/transaction');
const { HARD_UNBOOKABLE_STATUSES } = require('../../constants/carEnums');

function conflict(code, severity, message, meta = {}) {
  return { code, severity, message, ...meta };
}

async function checkReservationRangeConflicts({
  carId,
  start,
  end,
  excludeReservationId = null,
  force = false,
}) {
  const conflicts = [];
  const carIdNum = Number(carId);

  const carResult = await clientQuery(
    null,
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

  const hold = await reservationSql.findOverlappingHold({
    carId: carIdNum,
    startDate: start,
    endDate: end,
    now: new Date(),
  });
  if (hold && String(hold.id) !== String(excludeReservationId || '')) {
    conflicts.push(
      conflict('HOLD_OVERLAP', 'block', 'Overlaps an active payment hold.', {
        overridable: false,
        overlappingReservationId: String(hold.id),
      })
    );
  }

  const openPhysical = await reservationSql.findOpenPhysicalRental(carIdNum, null, {
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

  const blockResult = await clientQuery(
    null,
    `
    SELECT id, block_type, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = $1
      AND start_date < $3
      AND end_date > $2
    LIMIT 5
    `,
    [carIdNum, start, end]
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

  // Next pickup after this return — sequence check when resizing/moving
  const nextPickup = await clientQuery(
    null,
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
  // Sequence: if our return is after next pickup start — shouldn't happen if we check end < next.pickup
  // Cleaning buffer vs next pickup
  if (nextPickup.rows[0]) {
    const nextStart = new Date(nextPickup.rows[0].pickup_date).getTime();
    const ourEnd = new Date(end).getTime();
    const bufferMs = CLEANING_BUFFER_HOURS * 60 * 60 * 1000;
    if (ourEnd > nextStart) {
      conflicts.push(
        conflict('RETURN_AFTER_NEXT_PICKUP', 'block', 'Return is after the next pickup.', {
          overridable: true,
          nextReservationId: String(nextPickup.rows[0].id),
        })
      );
    } else if (nextStart - ourEnd < bufferMs) {
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

  const damage = await clientQuery(
    null,
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

function assertWritable(conflicts, { force = false, canOverride = false } = {}) {
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

  if (softBlocks.length > 0 && !(force && canOverride)) {
    const err = new Error(softBlocks[0].message);
    err.code = 'CALENDAR_CONFLICT';
    err.status = 409;
    err.conflicts = conflicts;
    throw err;
  }

  if (warns.length > 0 && force && !canOverride) {
    // force without override permission still blocked on warns that need override
  }

  return { conflicts, forced: Boolean(force && canOverride) };
}

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
