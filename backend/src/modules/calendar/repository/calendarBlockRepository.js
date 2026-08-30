const { clientQuery } = require('../../../db/transaction');

async function listManualBlocksInRange({ from, to, carIds = null }, client = null) {
  const params = [from, to];
  const where = [
    `b.start_date < $2`,
    `b.end_date > $1`,
    `b.block_type IN ('manual', 'maintenance', 'other')`,
  ];
  if (Array.isArray(carIds) && carIds.length > 0) {
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    where.push(`b.car_id = ANY($${params.length}::bigint[])`);
  }

  const result = await clientQuery(
    client,
    `
    SELECT b.id, b.car_id, b.start_date, b.end_date, b.block_type, b.reason, b.notes
    FROM car_date_blocks b
    WHERE ${where.join(' AND ')}
    ORDER BY b.start_date ASC
    `,
    params
  );
  return result.rows;
}

async function findBlockById(blockId, client = null) {
  const id = Number(blockId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const result = await clientQuery(
    client,
    `SELECT * FROM car_date_blocks WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function createManualBlock(payload, client = null) {
  const result = await clientQuery(
    client,
    `
    INSERT INTO car_date_blocks (
      car_id, start_date, end_date, block_type, reason, notes, created_by_user_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING *
    `,
    [
      Number(payload.carId),
      payload.start,
      payload.end,
      payload.blockType || 'manual',
      payload.reason || null,
      payload.notes || null,
      payload.createdByUserId != null ? Number(payload.createdByUserId) : null,
    ]
  );
  return result.rows[0];
}

async function updateManualBlock(
  blockId,
  { start, end, carId, blockType, reason, notes },
  client = null
) {
  const id = Number(blockId);
  const result = await clientQuery(
    client,
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
      id,
      start || null,
      end || null,
      carId != null ? Number(carId) : null,
      blockType || null,
      reason !== undefined ? reason : null,
      notes !== undefined ? notes : null,
    ]
  );
  return result.rows[0] || null;
}

async function deleteManualBlock(blockId, client = null) {
  const id = Number(blockId);
  const result = await clientQuery(
    client,
    `
    DELETE FROM car_date_blocks
    WHERE id = $1 AND block_type IN ('manual', 'maintenance', 'other')
    RETURNING *
    `,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = {
  listManualBlocksInRange,
  findBlockById,
  createManualBlock,
  updateManualBlock,
  deleteManualBlock,
};
