/**
 * Calendar date-block sync for cars: add/update/move/remove ranges and expire finished orders.
 * Critical for preventing double-booking; callers typically hold advisory locks.
 */
const { clientQuery, isCarDateBlockOverlapViolation } = require('../../db/transaction');
const { parseSofiaDate } = require('../../utils/timeZone');
const { toUtc } = require('../../utils/toUtc');

/**
 * Normalize car id before persistence or comparison.
 * @param {string|number} carId
 * @returns {*}
 */
function normalizeCarId(carId) {
  const id = Number(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    return null;
  }
  return id;
}

/**
 * overlap error.
 * @returns {*}
 */
function overlapError() {
  const err = new Error('Booking overlaps with existing dates');
  err.code = 'OVERLAP';
  return err;
}

const OPEN_PHYSICAL_RENTAL_STATUSES = `('picked_up', 'active_rental')`;

/**
 * open physical rental overlap sql.
 * @param {*} [blockAlias]
 * @returns {*}
 */
function openPhysicalRentalOverlapSql(blockAlias = 'b') {
  return `
    EXISTS (
      SELECT 1
      FROM reservations r_open
      WHERE r_open.car_id = ${blockAlias}.car_id
        AND r_open.status IN ${OPEN_PHYSICAL_RENTAL_STATUSES}
        AND ${blockAlias}.start_date < r_open.return_date
        AND ${blockAlias}.end_date > r_open.pickup_date
    )
  `;
}

// Премахва изтекли date blocks за една кола или за всички коли.
// Blocks tied to open physical rentals are extended first so overdue cars stay unbookable.
/**
 * extend open physical rental blocks.
 * @param {string|number} [carId]
 * @param {*} [now]
 * @returns {Promise<*>}
 */
async function extendOpenPhysicalRentalBlocks(carId = null, now = new Date(), client = null) {
  const normalizedCarId = carId ? normalizeCarId(carId) : null;
  // Guard: early-return or throw when required input is missing/invalid.
  if (carId && normalizedCarId === null) {
    return;
  }

  // Keep end strictly after now so a following DELETE ... end_date <= now leaves the row.
  const extendedEnd = new Date(now.getTime() + 1000);

  if (normalizedCarId) {
    await clientQuery(
      client,
      `
      UPDATE car_date_blocks b
      SET end_date = GREATEST(b.end_date, $2::timestamptz)
      FROM reservations r
      WHERE b.car_id = $1
        AND r.car_id = b.car_id
        AND r.status IN ${OPEN_PHYSICAL_RENTAL_STATUSES}
        AND b.start_date < r.return_date
        AND b.end_date > r.pickup_date
      `,
      [normalizedCarId, extendedEnd]
    );
    return;
  }

  await clientQuery(
    client,
    `
    UPDATE car_date_blocks b
    SET end_date = GREATEST(b.end_date, $1::timestamptz)
    FROM reservations r
    WHERE r.car_id = b.car_id
      AND r.status IN ${OPEN_PHYSICAL_RENTAL_STATUSES}
      AND b.start_date < r.return_date
      AND b.end_date > r.pickup_date
    `,
    [extendedEnd]
  );
}

// After return, prior extend may leave end_date slightly in the future; clamp back so DELETE can remove it.
/**
 * clamp closed physical rental blocks.
 * @param {string|number} [carId]
 * @param {*} [now]
 * @returns {Promise<*>}
 */
async function clampClosedPhysicalRentalBlocks(carId = null, now = new Date(), client = null) {
  const normalizedCarId = carId ? normalizeCarId(carId) : null;
  // Guard: early-return or throw when required input is missing/invalid.
  if (carId && normalizedCarId === null) {
    return;
  }

  const openOverlap = openPhysicalRentalOverlapSql('b2');

  if (normalizedCarId) {
    await clientQuery(
      client,
      `
      UPDATE car_date_blocks b
      SET end_date = src.clamp_end
      FROM (
        SELECT
          b2.id AS block_id,
          MAX(r.return_date) AS clamp_end
        FROM car_date_blocks b2
        INNER JOIN reservations r
          ON r.car_id = b2.car_id
         AND r.status NOT IN ${OPEN_PHYSICAL_RENTAL_STATUSES}
         AND r.return_date <= $2::timestamptz
         AND b2.start_date < r.return_date
         AND b2.end_date > r.pickup_date
        WHERE b2.car_id = $1
          AND NOT (${openOverlap})
        GROUP BY b2.id
      ) src
      WHERE b.id = src.block_id
        AND b.end_date > src.clamp_end
      `,
      [normalizedCarId, now]
    );
    return;
  }

  await clientQuery(
    client,
    `
    UPDATE car_date_blocks b
    SET end_date = src.clamp_end
    FROM (
      SELECT
        b2.id AS block_id,
        MAX(r.return_date) AS clamp_end
      FROM car_date_blocks b2
      INNER JOIN reservations r
        ON r.car_id = b2.car_id
       AND r.status NOT IN ${OPEN_PHYSICAL_RENTAL_STATUSES}
       AND r.return_date <= $1::timestamptz
       AND b2.start_date < r.return_date
       AND b2.end_date > r.pickup_date
      WHERE NOT (${openOverlap})
      GROUP BY b2.id
    ) src
    WHERE b.id = src.block_id
      AND b.end_date > src.clamp_end
    `,
    [now]
  );
}

/**
 * Extend open-rental blocks, clamp closed ones, then delete expired date blocks.
 * Extension runs first so overdue picked_up/active_rental cars stay unbookable.
 * @param {number|string|null} [carId] Null = all cars
 * @param {object|null} [client]
 */
async function purgeExpired(carId = null, client = null) {
  const now = new Date();
  const normalizedCarId = carId ? normalizeCarId(carId) : null;

  // Guard: early-return or throw when required input is missing/invalid.
  if (carId && normalizedCarId === null) {
    return;
  }

  // Protected block: isolate failure modes.
  try {
    await extendOpenPhysicalRentalBlocks(normalizedCarId, now, client);
  } catch (err) {
    // Extending into a later booking can hit GiST; keep the overdue block via DELETE guard below.
    if (!isCarDateBlockOverlapViolation(err)) {
      throw err;
    }
  }

  await clampClosedPhysicalRentalBlocks(normalizedCarId, now, client);

  const openRentalBlockGuard = `
    NOT EXISTS (
      SELECT 1
      FROM reservations r
      WHERE r.car_id = car_date_blocks.car_id
        AND r.status IN ${OPEN_PHYSICAL_RENTAL_STATUSES}
        AND car_date_blocks.start_date < r.return_date
        AND car_date_blocks.end_date > r.pickup_date
    )
  `;

  if (normalizedCarId) {
    await clientQuery(
      client,
      `
      DELETE FROM car_date_blocks
      WHERE car_id = $1
        AND end_date <= $2
        AND ${openRentalBlockGuard}
      `,
      [normalizedCarId, now]
    );
    return;
  }

  await clientQuery(
    client,
    `
    DELETE FROM car_date_blocks
    WHERE end_date <= $1
      AND ${openRentalBlockGuard}
    `,
    [now]
  );
}

// Хвърля OVERLAP ако новият интервал се застъпва със съществуващ block.
// Fast-path check; authoritative protection is no_overlapping_car_blocks (GiST EXCLUDE).
/**
 * Throw OVERLAP if any car_date_blocks row intersects [start, end).
 * @param {number|string} carId
 * @param {Date} start
 * @param {Date} end
 * @param {object|null} [client]
 */
async function assertNoOverlap(carId, start, end, client = null) {
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const result = await clientQuery(
    client,
    `
    SELECT 1
    FROM car_date_blocks
    WHERE car_id = $1
      AND start_date < $3
      AND end_date > $2
    LIMIT 1
    `,
    [normalizedCarId, start, end]
  );

  if (result.rowCount > 0) {
    throw overlapError();
  }
}

/**
 * Insert date block and return the mapped result.
 * @param {string|number} carId
 * @param {*} start
 * @param {*} end
 * @param {object|null} [client]
 * @param {object} [options]
 * @returns {Promise<*>}
 */
async function insertDateBlock(carId, start, end, client = null, options = {}) {
  const blockType = options.blockType || 'booking';
  const reason = options.reason || null;
  const notes = options.notes || null;
  const createdByUserId = options.createdByUserId != null ? Number(options.createdByUserId) : null;

  // Protected block: isolate failure modes.
  try {
    await clientQuery(
      client,
      `
      INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type, reason, notes, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        carId,
        start,
        end,
        blockType,
        reason,
        notes,
        Number.isInteger(createdByUserId) && createdByUserId > 0 ? createdByUserId : null,
      ]
    );
  } catch (err) {
    // Concurrency / overlap guard (race-sensitive).
    if (isCarDateBlockOverlapViolation(err)) {
      throw overlapError();
    }
    throw err;
  }
}

/**
 * Book a calendar range: purge expired, assert no overlap, insert date block.
 * Unique/exclusion constraints may still raise; mapped to OVERLAP where applicable.
 * @param {number|string} carId
 * @param {Date} start
 * @param {Date} end
 * @param {object|null} [client]
 * @param {object} [options]
 */
async function addRange(carId, start, end, client = null, options = {}) {
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const s = toUtc(start);
  const e = toUtc(end);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!(s < e)) {
    throw new Error('Invalid date range');
  }

  await purgeExpired(normalizedCarId, client);
  await assertNoOverlap(normalizedCarId, s, e, client);
  await insertDateBlock(normalizedCarId, s, e, client, {
    blockType: options.blockType || 'booking',
    reason: options.reason,
    notes: options.notes,
    createdByUserId: options.createdByUserId,
  });
}

/**
 * Resize a booking on the same car: remove previous block endpoints then add the new range.
 * @param {number|string} carId
 * @param {Date} prevStart
 * @param {Date} prevEnd
 * @param {Date} newStart
 * @param {Date} newEnd
 * @param {object|null} [client]
 */
async function updateRange(carId, prevStart, prevEnd, newStart, newEnd, client = null) {
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    throw new Error('Invalid car id');
  }

  const ps = toUtc(prevStart);
  const pe = toUtc(prevEnd);
  const ns = toUtc(newStart);
  const ne = toUtc(newEnd);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!(ns < ne)) {
    throw new Error('Invalid date range');
  }

  await purgeExpired(normalizedCarId, client);
  await clientQuery(
    client,
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1 AND start_date = $2 AND end_date = $3
    `,
    [normalizedCarId, ps, pe]
  );
  await assertNoOverlap(normalizedCarId, ns, ne, client);
  await insertDateBlock(normalizedCarId, ns, ne, client);
}

/**
 * Move a booking between cars: remove from prev car, add on new car (same transaction preferred).
 * @param {number|string} prevCarId
 * @param {number|string} newCarId
 * @param {Date} prevStart
 * @param {Date} prevEnd
 * @param {Date} newStart
 * @param {Date} newEnd
 * @param {object|null} [client]
 */
async function moveRange(prevCarId, newCarId, prevStart, prevEnd, newStart, newEnd, client = null) {
  const prevId = normalizeCarId(prevCarId);
  const newId = normalizeCarId(newCarId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!prevId || !newId) {
    throw new Error('Invalid car id');
  }

  const ps = toUtc(prevStart);
  const pe = toUtc(prevEnd);
  const ns = toUtc(newStart);
  const ne = toUtc(newEnd);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!(ns < ne)) {
    throw new Error('Invalid date range');
  }

  await purgeExpired(prevId, client);
  await purgeExpired(newId, client);
  await assertNoOverlap(newId, ns, ne, client);
  await clientQuery(
    client,
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1 AND start_date = $2 AND end_date = $3
    `,
    [prevId, ps, pe]
  );
  await insertDateBlock(newId, ns, ne, client);
}

/**
 * Delete the date block matching start/end for a car (soft-delete / cancel path).
 * @param {number|string} carId
 * @param {Date} startDate
 * @param {Date} endDate
 * @param {object|null} [client]
 */
async function removeRange(carId, startDate, endDate, client = null) {
  // Guard: early-return or throw when required input is missing/invalid.
  if (!carId || !startDate || !endDate) {
    return;
  }

  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    return;
  }

  await clientQuery(
    client,
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1 AND start_date = $2 AND end_date = $3
    `,
    [normalizedCarId, startDate, endDate]
  );
}

// Премахва blocks без съответстващ активен order – repair helper за drift.
/**
 * purge orphaned.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function purgeOrphaned(carId, client = null) {
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    return;
  }

  const blocksResult = await clientQuery(
    client,
    `
    SELECT id, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = $1
    `,
    [normalizedCarId]
  );

  // Guard: early-return or throw when required input is missing/invalid.
  if (!blocksResult.rows.length) {
    return;
  }

  const ordersResult = await clientQuery(
    client,
    `
    SELECT pickup_date, pickup_time, return_date, return_time
    FROM orders
    WHERE car_id = $1 AND is_deleted = FALSE
    `,
    [normalizedCarId]
  );

  const hasOverlapWithAnyOrder = (range) => {
    const rs = new Date(range.start_date);
    const re = new Date(range.end_date);

    return ordersResult.rows.some((order) => {
      const os = parseSofiaDate(order.pickup_date, order.pickup_time || '00:00');
      const oe = parseSofiaDate(order.return_date, order.return_time || '23:59');
      if (!os || !oe || Number.isNaN(os.getTime()) || Number.isNaN(oe.getTime())) {
        return false;
      }
      return os < re && oe > rs;
    });
  };

  const orphanIds = blocksResult.rows
    .filter((block) => !hasOverlapWithAnyOrder(block))
    .map((block) => block.id);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!orphanIds.length) {
    return;
  }

  await clientQuery(
    client,
    `DELETE FROM car_date_blocks WHERE id = ANY($1::bigint[])`,
    [orphanIds]
  );
}

/**
 * Mark active orders whose return date has passed as expired (dashboard/list hygiene).
 * @param {object|null} [client]
 */
async function expireFinishedOrders(client = null) {
  const now = new Date();

  await clientQuery(
    client,
    `
    UPDATE orders
    SET status = 'expired',
        expired_at = $1,
        updated_at = $1
    WHERE return_date <= $1
      AND status NOT IN ('expired', 'cancelled')
      AND is_deleted = FALSE
    `,
    [now]
  );
}

/**
 * Load date blocks by car ids.
 * @param {Array<*>} carIds
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function fetchDateBlocksByCarIds(carIds, client = null) {
  const normalizedIds = [...new Set(
    carIds
      .map(normalizeCarId)
      .filter((id) => id !== null)
  )];

  const map = new Map();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedIds.length) {
    return map;
  }

  const result = await clientQuery(
    client,
    `
    SELECT car_id, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = ANY($1::bigint[])
    ORDER BY start_date ASC
    `,
    [normalizedIds]
  );

  for (const row of result.rows) {
    const carId = Number(row.car_id);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!map.has(carId)) {
      map.set(carId, []);
    }
    map.get(carId).push({
      startDate: row.start_date,
      endDate: row.end_date,
    });
  }

  return map;
}

/**
 * Load date blocks for car.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function fetchDateBlocksForCar(carId, client = null) {
  const map = await fetchDateBlocksByCarIds([carId], client);
  const normalizedCarId = normalizeCarId(carId);
  return map.get(normalizedCarId) || [];
}

module.exports = {
  purgeExpired,
  purgeOrphaned,
  addRange,
  updateRange,
  moveRange,
  removeRange,
  expireFinishedOrders,
  fetchDateBlocksByCarIds,
  fetchDateBlocksForCar,
};
