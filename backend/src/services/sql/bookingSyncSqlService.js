/**
 * Calendar date-block sync for cars: add/update/move/remove ranges and expire finished orders.
 * Critical for preventing double-booking; callers typically hold advisory locks.
 */
const { clientQuery, isCarDateBlockOverlapViolation } = require('../../db/transaction');
// Destructure object properties into local variables.
const { parseSofiaDate } = require('../../utils/timeZone');
// Destructure object properties into local variables.
const { toUtc } = require('../../utils/toUtc');

/**
 * Normalize car id before persistence or comparison.
 * @param {string|number} carId
 * @returns {*}
 */
function normalizeCarId(carId) {
  // Create the id constant.
  const id = Number(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!Number.isInteger(id) || id <= 0) {
    // Return the resulting value to the caller.
    return null;
  }
  // Return the resulting value to the caller.
  return id;
}

/**
 * overlap error.
 * @returns {*}
 */
function overlapError() {
  // Create the err constant.
  const err = new Error('Booking overlaps with existing dates');
  // Update err.code with the right-hand side value.
  err.code = 'OVERLAP';
  // Return the resulting value to the caller.
  return err;
}

// Create the open physical rental statuses constant.
const OPEN_PHYSICAL_RENTAL_STATUSES = `('picked_up', 'active_rental')`;

/**
 * open physical rental overlap sql.
 * @param {*} [blockAlias]
 * @returns {*}
 */
function openPhysicalRentalOverlapSql(blockAlias = 'b') {
  // Return the resulting value to the caller.
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
  // Create the normalized car id constant.
  const normalizedCarId = carId ? normalizeCarId(carId) : null;
  // Guard: early-return or throw when required input is missing/invalid.
  if (carId && normalizedCarId === null) {
    // Return control to the caller with the following value.
    return;
  }

  // Keep end strictly after now so a following DELETE ... end_date <= now leaves the row.
  const extendedEnd = new Date(now.getTime() + 1000);

  // Evaluate the condition and enter the branch when it is true.
  if (normalizedCarId) {
    // Wait until the asynchronous operation resolves.
    await clientQuery(
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      [normalizedCarId, extendedEnd]
    );
    // Return control to the caller with the following value.
    return;
  }

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE car_date_blocks b
    SET end_date = GREATEST(b.end_date, $1::timestamptz)
    FROM reservations r
    WHERE r.car_id = b.car_id
      AND r.status IN ${OPEN_PHYSICAL_RENTAL_STATUSES}
      AND b.start_date < r.return_date
      AND b.end_date > r.pickup_date
    `,
    // Contribute this line to the enclosing declaration or statement.
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
  // Create the normalized car id constant.
  const normalizedCarId = carId ? normalizeCarId(carId) : null;
  // Guard: early-return or throw when required input is missing/invalid.
  if (carId && normalizedCarId === null) {
    // Return control to the caller with the following value.
    return;
  }

  // Create the open overlap constant.
  const openOverlap = openPhysicalRentalOverlapSql('b2');

  // Evaluate the condition and enter the branch when it is true.
  if (normalizedCarId) {
    // Wait until the asynchronous operation resolves.
    await clientQuery(
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      [normalizedCarId, now]
    );
    // Return control to the caller with the following value.
    return;
  }

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
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
  // Create the now constant.
  const now = new Date();
  // Create the normalized car id constant.
  const normalizedCarId = carId ? normalizeCarId(carId) : null;

  // Guard: early-return or throw when required input is missing/invalid.
  if (carId && normalizedCarId === null) {
    // Return control to the caller with the following value.
    return;
  }

  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await extendOpenPhysicalRentalBlocks(normalizedCarId, now, client);
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Extending into a later booking can hit GiST; keep the overdue block via DELETE guard below.
    if (!isCarDateBlockOverlapViolation(err)) {
      // Throw an error to stop the current control flow.
      throw err;
    }
  }

  // Wait until the asynchronous operation resolves.
  await clampClosedPhysicalRentalBlocks(normalizedCarId, now, client);

  // Create the open rental block guard constant.
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

  // Evaluate the condition and enter the branch when it is true.
  if (normalizedCarId) {
    // Wait until the asynchronous operation resolves.
    await clientQuery(
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Continue the surrounding logic with this statement.
      `
      DELETE FROM car_date_blocks
      WHERE car_id = $1
        AND end_date <= $2
        AND ${openRentalBlockGuard}
      `,
      // Contribute this line to the enclosing declaration or statement.
      [normalizedCarId, now]
    );
    // Return control to the caller with the following value.
    return;
  }

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_date_blocks
    WHERE end_date <= $1
      AND ${openRentalBlockGuard}
    `,
    // Contribute this line to the enclosing declaration or statement.
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
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT 1
    FROM car_date_blocks
    WHERE car_id = $1
      AND start_date < $3
      AND end_date > $2
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedCarId, start, end]
  );

  // Evaluate the condition and enter the branch when it is true.
  if (result.rowCount > 0) {
    // Throw an error to stop the current control flow.
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
  // Create the block type constant.
  const blockType = options.blockType || 'booking';
  // Create the reason constant.
  const reason = options.reason || null;
  // Create the notes constant.
  const notes = options.notes || null;
  // Create the created by user id constant.
  const createdByUserId = options.createdByUserId != null ? Number(options.createdByUserId) : null;

  // Protected block: isolate failure modes.
  try {
    // Wait until the asynchronous operation resolves.
    await clientQuery(
      // Contribute this line to the enclosing declaration or statement.
      client,
      // Continue the surrounding logic with this statement.
      `
      INSERT INTO car_date_blocks (car_id, start_date, end_date, block_type, reason, notes, created_by_user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      `,
      [
        // Contribute this line to the enclosing declaration or statement.
        carId,
        // Contribute this line to the enclosing declaration or statement.
        start,
        // Contribute this line to the enclosing declaration or statement.
        end,
        // Contribute this line to the enclosing declaration or statement.
        blockType,
        // Contribute this line to the enclosing declaration or statement.
        reason,
        // Contribute this line to the enclosing declaration or statement.
        notes,
        // Call Number.isInteger to perform this step.
        Number.isInteger(createdByUserId) && createdByUserId > 0 ? createdByUserId : null,
      ]
    );
  // Continue the surrounding logic with this statement.
  } catch (err) {
    // Concurrency / overlap guard (race-sensitive).
    if (isCarDateBlockOverlapViolation(err)) {
      // Throw an error to stop the current control flow.
      throw overlapError();
    }
    // Throw an error to stop the current control flow.
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
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }

  // Create the s constant.
  const s = toUtc(start);
  // Create the e constant.
  const e = toUtc(end);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!(s < e)) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid date range');
  }

  // Wait until the asynchronous operation resolves.
  await purgeExpired(normalizedCarId, client);
  // Wait until the asynchronous operation resolves.
  await assertNoOverlap(normalizedCarId, s, e, client);
  // Wait until the asynchronous operation resolves.
  await insertDateBlock(normalizedCarId, s, e, client, {
    // Provide the block type field value.
    blockType: options.blockType || 'booking',
    // Provide the reason field value.
    reason: options.reason,
    // Provide the notes field value.
    notes: options.notes,
    // Provide the created by user id field value.
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
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }

  // Create the ps constant.
  const ps = toUtc(prevStart);
  // Create the pe constant.
  const pe = toUtc(prevEnd);
  // Create the ns constant.
  const ns = toUtc(newStart);
  // Create the ne constant.
  const ne = toUtc(newEnd);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!(ns < ne)) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid date range');
  }

  // Wait until the asynchronous operation resolves.
  await purgeExpired(normalizedCarId, client);
  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1 AND start_date = $2 AND end_date = $3
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedCarId, ps, pe]
  );
  // Wait until the asynchronous operation resolves.
  await assertNoOverlap(normalizedCarId, ns, ne, client);
  // Wait until the asynchronous operation resolves.
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
  // Create the prev id constant.
  const prevId = normalizeCarId(prevCarId);
  // Create the new id constant.
  const newId = normalizeCarId(newCarId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!prevId || !newId) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid car id');
  }

  // Create the ps constant.
  const ps = toUtc(prevStart);
  // Create the pe constant.
  const pe = toUtc(prevEnd);
  // Create the ns constant.
  const ns = toUtc(newStart);
  // Create the ne constant.
  const ne = toUtc(newEnd);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!(ns < ne)) {
    // Throw an error to stop the current control flow.
    throw new Error('Invalid date range');
  }

  // Wait until the asynchronous operation resolves.
  await purgeExpired(prevId, client);
  // Wait until the asynchronous operation resolves.
  await purgeExpired(newId, client);
  // Wait until the asynchronous operation resolves.
  await assertNoOverlap(newId, ns, ne, client);
  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1 AND start_date = $2 AND end_date = $3
    `,
    // Contribute this line to the enclosing declaration or statement.
    [prevId, ps, pe]
  );
  // Wait until the asynchronous operation resolves.
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
    // Return control to the caller with the following value.
    return;
  }

  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Return control to the caller with the following value.
    return;
  }

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_date_blocks
    WHERE car_id = $1 AND start_date = $2 AND end_date = $3
    `,
    // Contribute this line to the enclosing declaration or statement.
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
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedCarId) {
    // Return control to the caller with the following value.
    return;
  }

  // Create the blocks result constant.
  const blocksResult = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT id, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = $1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedCarId]
  );

  // Guard: early-return or throw when required input is missing/invalid.
  if (!blocksResult.rows.length) {
    // Return control to the caller with the following value.
    return;
  }

  // Create the orders result constant.
  const ordersResult = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT pickup_date, pickup_time, return_date, return_time
    FROM orders
    WHERE car_id = $1 AND is_deleted = FALSE
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedCarId]
  );

  // Create the has overlap with any order constant.
  const hasOverlapWithAnyOrder = (range) => {
    // Create the rs constant.
    const rs = new Date(range.start_date);
    // Create the re constant.
    const re = new Date(range.end_date);

    // Return the resulting value to the caller.
    return ordersResult.rows.some((order) => {
      // Create the os constant.
      const os = parseSofiaDate(order.pickup_date, order.pickup_time || '00:00');
      // Create the oe constant.
      const oe = parseSofiaDate(order.return_date, order.return_time || '23:59');
      // Evaluate the condition and enter the branch when it is true.
      if (!os || !oe || Number.isNaN(os.getTime()) || Number.isNaN(oe.getTime())) {
        // Return the resulting value to the caller.
        return false;
      }
      // Return the resulting value to the caller.
      return os < re && oe > rs;
    });
  };

  // Create the orphan ids constant.
  const orphanIds = blocksResult.rows
    // Call .filter to perform this step.
    .filter((block) => !hasOverlapWithAnyOrder(block))
    // Call .map to perform this step.
    .map((block) => block.id);

  // Guard: early-return or throw when required input is missing/invalid.
  if (!orphanIds.length) {
    // Return control to the caller with the following value.
    return;
  }

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `DELETE FROM car_date_blocks WHERE id = ANY($1::bigint[])`,
    // Contribute this line to the enclosing declaration or statement.
    [orphanIds]
  );
}

/**
 * Mark active orders whose return date has passed as expired (dashboard/list hygiene).
 * @param {object|null} [client]
 */
async function expireFinishedOrders(client = null) {
  // Create the now constant.
  const now = new Date();

  // Wait until the asynchronous operation resolves.
  await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE orders
    SET status = 'expired',
        expired_at = $1,
        updated_at = $1
    WHERE return_date <= $1
      AND status NOT IN ('expired', 'cancelled')
      AND is_deleted = FALSE
    `,
    // Contribute this line to the enclosing declaration or statement.
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
  // Create the normalized ids constant.
  const normalizedIds = [...new Set(
    // Reference the identifier used by the enclosing expression.
    carIds
      // Call .map to perform this step.
      .map(normalizeCarId)
      // Call .filter to perform this step.
      .filter((id) => id !== null)
  )];

  // Create the map constant.
  const map = new Map();
  // Guard: early-return or throw when required input is missing/invalid.
  if (!normalizedIds.length) {
    // Return the resulting value to the caller.
    return map;
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT car_id, start_date, end_date
    FROM car_date_blocks
    WHERE car_id = ANY($1::bigint[])
    ORDER BY start_date ASC
    `,
    // Contribute this line to the enclosing declaration or statement.
    [normalizedIds]
  );

  // Iterate using the loop initializer, condition, and step.
  for (const row of result.rows) {
    // Create the car id constant.
    const carId = Number(row.car_id);
    // Guard: early-return or throw when required input is missing/invalid.
    if (!map.has(carId)) {
      // Call map.set to perform this step.
      map.set(carId, []);
    }
    // Call map.get to perform this step.
    map.get(carId).push({
      // Provide the start date field value.
      startDate: row.start_date,
      // Provide the end date field value.
      endDate: row.end_date,
    });
  }

  // Return the resulting value to the caller.
  return map;
}

/**
 * Load date blocks for car.
 * @param {string|number} carId
 * @param {object|null} [client]
 * @returns {Promise<*>}
 */
async function fetchDateBlocksForCar(carId, client = null) {
  // Create the map constant.
  const map = await fetchDateBlocksByCarIds([carId], client);
  // Create the normalized car id constant.
  const normalizedCarId = normalizeCarId(carId);
  // Return the resulting value to the caller.
  return map.get(normalizedCarId) || [];
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  purgeExpired,
  // Contribute this line to the enclosing declaration or statement.
  purgeOrphaned,
  // Contribute this line to the enclosing declaration or statement.
  addRange,
  // Contribute this line to the enclosing declaration or statement.
  updateRange,
  // Contribute this line to the enclosing declaration or statement.
  moveRange,
  // Contribute this line to the enclosing declaration or statement.
  removeRange,
  // Contribute this line to the enclosing declaration or statement.
  expireFinishedOrders,
  // Contribute this line to the enclosing declaration or statement.
  fetchDateBlocksByCarIds,
  // Contribute this line to the enclosing declaration or statement.
  fetchDateBlocksForCar,
};
