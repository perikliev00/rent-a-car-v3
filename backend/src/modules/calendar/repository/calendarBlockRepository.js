/**
 * Persistence for staff-created car_date_blocks (manual / maintenance / other).
 * Booking-synced rows are excluded from list/update/delete here.
 */

const { clientQuery } = require('../../../db/transaction');

/**
 * List overlapping staff blocks in range (excludes booking type).
 * @param {{ from: Date|string, to: Date|string, carIds?: Array|null }} opts
 */
async function listManualBlocksInRange({ from, to, carIds = null }, client = null) {
  // Create the params constant.
  const params = [from, to];
  // Create the where constant.
  const where = [
    // Continue the surrounding logic with this statement.
    `b.start_date < $2`,
    // Continue the surrounding logic with this statement.
    `b.end_date > $1`,
    // Continue the surrounding logic with this statement.
    `b.block_type IN ('manual', 'maintenance', 'other')`,
  ];
  // Evaluate the condition and enter the branch when it is true.
  if (Array.isArray(carIds) && carIds.length > 0) {
    // Call params.push to perform this step.
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    // Call where.push to perform this step.
    where.push(`b.car_id = ANY($${params.length}::bigint[])`);
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT b.id, b.car_id, b.start_date, b.end_date, b.block_type, b.reason, b.notes
    FROM car_date_blocks b
    WHERE ${where.join(' AND ')}
    ORDER BY b.start_date ASC
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Return the resulting value to the caller.
  return result.rows;
}

/** @param {string|number} blockId */
async function findBlockById(blockId, client = null) {
  // Create the id constant.
  const id = Number(blockId);
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(id) || id <= 0) return null;
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `SELECT * FROM car_date_blocks WHERE id = $1 LIMIT 1`,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

/**
 * Insert a staff block row.
 * @param {object} payload carId, start, end, blockType, reason, notes, createdByUserId
 */
async function createManualBlock(payload, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO car_date_blocks (
      car_id, start_date, end_date, block_type, reason, notes, created_by_user_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [
      // Call Number to perform this step.
      Number(payload.carId),
      // Contribute this line to the enclosing declaration or statement.
      payload.start,
      // Contribute this line to the enclosing declaration or statement.
      payload.end,
      // Contribute this line to the enclosing declaration or statement.
      payload.blockType || 'manual',
      // Contribute this line to the enclosing declaration or statement.
      payload.reason || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.notes || null,
      // Continue the surrounding logic with this statement.
      payload.createdByUserId != null ? Number(payload.createdByUserId) : null,
    ]
  );
  // Return the resulting value to the caller.
  return result.rows[0];
}

/**
 * Update a staff block; WHERE restricts to editable block_types only.
 */
async function updateManualBlock(
  // Contribute this line to the enclosing declaration or statement.
  blockId,
  // Contribute this line to the enclosing declaration or statement.
  { start, end, carId, blockType, reason, notes },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the id constant.
  const id = Number(blockId);
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE car_date_blocks
    SET start_date = COALESCE($2, start_date),
        end_date = COALESCE($3, end_date),
        car_id = COALESCE($4, car_id),
        block_type = COALESCE($5, block_type),
        reason = COALESCE($6, reason),
        notes = COALESCE($7, notes)
    WHERE id = $1 AND block_type IN ('manual', 'maintenance', 'other')
    RETURNING *
    `,
    [
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Contribute this line to the enclosing declaration or statement.
      start || null,
      // Contribute this line to the enclosing declaration or statement.
      end || null,
      // Continue the surrounding logic with this statement.
      carId != null ? Number(carId) : null,
      // Contribute this line to the enclosing declaration or statement.
      blockType || null,
      // Continue the surrounding logic with this statement.
      reason !== undefined ? reason : null,
      // Continue the surrounding logic with this statement.
      notes !== undefined ? notes : null,
    ]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

/** Delete staff block only (booking rows untouched). */
async function deleteManualBlock(blockId, client = null) {
  // Create the id constant.
  const id = Number(blockId);
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    DELETE FROM car_date_blocks
    WHERE id = $1 AND block_type IN ('manual', 'maintenance', 'other')
    RETURNING *
    `,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listManualBlocksInRange,
  // Contribute this line to the enclosing declaration or statement.
  findBlockById,
  // Contribute this line to the enclosing declaration or statement.
  createManualBlock,
  // Contribute this line to the enclosing declaration or statement.
  updateManualBlock,
  // Contribute this line to the enclosing declaration or statement.
  deleteManualBlock,
};
