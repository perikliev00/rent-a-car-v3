const { clientQuery } = require('../../db/transaction');
const { TERMINAL_STATUSES } = require('../../domain/reservationStatus');

function mapTask(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    carId: row.car_id != null ? String(row.car_id) : null,
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    taskType: row.task_type,
    title: row.title,
    notes: row.notes || null,
    locationText: row.location_text || null,
    startsAt: row.starts_at,
    dueAt: row.due_at,
    status: row.status,
    assignedToUserId: row.assigned_to_user_id != null ? String(row.assigned_to_user_id) : null,
    createdByUserId: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listCarsForCalendar({ filters = {}, carIds = null } = {}, client = null) {
  const where = ['c.is_deleted = FALSE'];
  const params = [];

  if (Array.isArray(carIds) && carIds.length > 0) {
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    where.push(`c.id = ANY($${params.length}::bigint[])`);
  }
  if (filters.categoryId) {
    params.push(Number(filters.categoryId));
    where.push(`c.category_id = $${params.length}`);
  }
  if (filters.transmission) {
    params.push(filters.transmission);
    where.push(`c.transmission = $${params.length}`);
  }
  if (filters.fuelType) {
    params.push(filters.fuelType);
    where.push(`c.fuel_type = $${params.length}`);
  }
  if (filters.carStatus) {
    params.push(filters.carStatus);
    where.push(`c.status = $${params.length}`);
  }
  if (filters.location) {
    params.push(`%${filters.location}%`);
    where.push(`c.current_location ILIKE $${params.length}`);
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      c.id, c.name, c.transmission, c.fuel_type, c.status,
      c.current_location, c.insurance_expiry, c.technical_inspection_expiry,
      c.category_id, cat.name AS category_name
    FROM cars c
    LEFT JOIN categories cat ON cat.id = c.category_id
    WHERE ${where.join(' AND ')}
    ORDER BY c.name ASC
    `,
    params
  );

  return result.rows.map((row) => ({
    id: String(row.id),
    name: row.name,
    transmission: row.transmission,
    fuelType: row.fuel_type,
    status: row.status,
    currentLocation: row.current_location || null,
    insuranceExpiry: row.insurance_expiry,
    technicalInspectionExpiry: row.technical_inspection_expiry,
    categoryId: row.category_id != null ? String(row.category_id) : null,
    categoryName: row.category_name || null,
  }));
}

async function listReservationsInRange({ from, to, carIds = null, statuses = null }, client = null) {
  const params = [from, to];
  const where = [
    `r.pickup_date < $2`,
    `r.return_date > $1`,
    `r.status <> ALL($${params.push(TERMINAL_STATUSES)}::text[])`,
  ];

  if (Array.isArray(carIds) && carIds.length > 0) {
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    where.push(`r.car_id = ANY($${params.length}::bigint[])`);
  }
  if (Array.isArray(statuses) && statuses.length > 0) {
    params.push(statuses);
    where.push(`r.status = ANY($${params.length}::text[])`);
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      r.id, r.car_id, r.status, r.pickup_date, r.return_date,
      r.pickup_time, r.return_time, r.pickup_location, r.return_location,
      r.full_name, r.email, r.phone_number, r.total_price,
      c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE ${where.join(' AND ')}
    ORDER BY r.pickup_date ASC
    `,
    params
  );
  return result.rows;
}

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

async function listTasksInRange(
  { from, to, carIds = null, assignedToUserId = null, includeUnassigned = true },
  client = null
) {
  const params = [from, to];
  const where = [
    `(
      (t.starts_at IS NOT NULL AND t.starts_at < $2 AND COALESCE(t.due_at, t.starts_at) > $1)
      OR (t.starts_at IS NULL AND t.due_at IS NOT NULL AND t.due_at >= $1 AND t.due_at < $2)
    )`,
    `t.status <> 'cancelled'`,
  ];

  if (assignedToUserId != null) {
    params.push(Number(assignedToUserId));
    where.push(`t.assigned_to_user_id = $${params.length}`);
  }
  if (Array.isArray(carIds) && carIds.length > 0) {
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    where.push(`(t.car_id IS NULL OR t.car_id = ANY($${params.length}::bigint[]))`);
  }
  if (!includeUnassigned && assignedToUserId == null) {
    where.push(`t.assigned_to_user_id IS NOT NULL`);
  }

  const result = await clientQuery(
    client,
    `
    SELECT *
    FROM calendar_tasks t
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(t.starts_at, t.due_at) ASC NULLS LAST
    `,
    params
  );
  return result.rows;
}

/**
 * Filtered task list for staff dashboards / manager board.
 */
async function listTasks(
  {
    from = null,
    to = null,
    assignedToUserId = null,
    unassigned = false,
    taskType = null,
    taskTypes = null,
    status = null,
    carId = null,
    includeCancelled = false,
  } = {},
  client = null
) {
  const params = [];
  const where = ['TRUE'];

  if (from && to) {
    params.push(from, to);
    where.push(`(
      (t.starts_at IS NOT NULL AND t.starts_at < $${params.length} AND COALESCE(t.due_at, t.starts_at) > $${params.length - 1})
      OR (t.starts_at IS NULL AND t.due_at IS NOT NULL AND t.due_at >= $${params.length - 1} AND t.due_at < $${params.length})
      OR (t.starts_at IS NULL AND t.due_at IS NULL AND t.created_at >= $${params.length - 1} AND t.created_at < $${params.length})
    )`);
  } else if (from) {
    params.push(from);
    where.push(`COALESCE(t.due_at, t.starts_at, t.created_at) >= $${params.length}`);
  } else if (to) {
    params.push(to);
    where.push(`COALESCE(t.starts_at, t.due_at, t.created_at) < $${params.length}`);
  }

  if (assignedToUserId != null) {
    params.push(Number(assignedToUserId));
    where.push(`t.assigned_to_user_id = $${params.length}`);
  }
  if (unassigned) {
    where.push(`t.assigned_to_user_id IS NULL`);
  }
  if (taskType) {
    params.push(taskType);
    where.push(`t.task_type = $${params.length}`);
  }
  if (Array.isArray(taskTypes) && taskTypes.length > 0) {
    params.push(taskTypes);
    where.push(`t.task_type = ANY($${params.length}::text[])`);
  }
  if (status) {
    params.push(status);
    where.push(`t.status = $${params.length}`);
  } else if (!includeCancelled) {
    where.push(`t.status <> 'cancelled'`);
  }
  if (carId != null) {
    params.push(Number(carId));
    where.push(`t.car_id = $${params.length}`);
  }

  const result = await clientQuery(
    client,
    `
    SELECT
      t.*,
      c.name AS car_name
    FROM calendar_tasks t
    LEFT JOIN cars c ON c.id = t.car_id
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(t.due_at, t.starts_at, t.created_at) ASC NULLS LAST
    LIMIT 500
    `,
    params
  );

  return result.rows.map((row) => ({
    ...mapTask(row),
    carName: row.car_name || null,
  }));
}

async function findTaskById(taskId, client = null) {
  const id = Number(taskId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const result = await clientQuery(
    client,
    `SELECT * FROM calendar_tasks WHERE id = $1 LIMIT 1`,
    [id]
  );
  return result.rows[0] || null;
}

async function hasAssignedTask(userId, reservationId, client = null) {
  const uid = Number(userId);
  const rid = Number(reservationId);
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(rid) || rid <= 0) {
    return false;
  }
  const result = await clientQuery(
    client,
    `
    SELECT 1
    FROM calendar_tasks
    WHERE reservation_id = $1
      AND assigned_to_user_id = $2
    LIMIT 1
    `,
    [rid, uid]
  );
  return result.rows.length > 0;
}

async function createTask(payload, client = null) {
  const result = await clientQuery(
    client,
    `
    INSERT INTO calendar_tasks (
      car_id, reservation_id, task_type, title, notes, location_text,
      starts_at, due_at, status, assigned_to_user_id, created_by_user_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
    `,
    [
      payload.carId != null ? Number(payload.carId) : null,
      payload.reservationId != null ? Number(payload.reservationId) : null,
      payload.taskType,
      payload.title,
      payload.notes || null,
      payload.locationText || null,
      payload.startsAt || null,
      payload.dueAt || null,
      payload.status || 'pending',
      payload.assignedToUserId != null ? Number(payload.assignedToUserId) : null,
      payload.createdByUserId != null ? Number(payload.createdByUserId) : null,
    ]
  );
  return mapTask(result.rows[0]);
}

async function updateTaskStatus(taskId, status, client = null) {
  const id = Number(taskId);
  const next = String(status);
  const result = await clientQuery(
    client,
    `
    UPDATE calendar_tasks
    SET status = $2::text,
        completed_at = CASE WHEN $2::text = 'completed' THEN COALESCE(completed_at, NOW()) ELSE NULL END,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [id, next]
  );
  return mapTask(result.rows[0]);
}

async function updateTaskSchedule(taskId, { startsAt, dueAt, carId }, client = null) {
  const id = Number(taskId);
  const result = await clientQuery(
    client,
    `
    UPDATE calendar_tasks
    SET starts_at = COALESCE($2, starts_at),
        due_at = COALESCE($3, due_at),
        car_id = COALESCE($4, car_id),
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      startsAt || null,
      dueAt || null,
      carId != null ? Number(carId) : null,
    ]
  );
  return mapTask(result.rows[0]);
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

async function updateTask(taskId, fields, client = null) {
  const id = Number(taskId);
  const result = await clientQuery(
    client,
    `
    UPDATE calendar_tasks
    SET title = COALESCE($2, title),
        task_type = COALESCE($3, task_type),
        car_id = CASE WHEN $4::boolean THEN $5 ELSE car_id END,
        starts_at = CASE WHEN $6::boolean THEN $7 ELSE starts_at END,
        due_at = CASE WHEN $8::boolean THEN $9 ELSE due_at END,
        location_text = CASE WHEN $10::boolean THEN $11 ELSE location_text END,
        notes = CASE WHEN $12::boolean THEN $13 ELSE notes END,
        assigned_to_user_id = CASE WHEN $14::boolean THEN $15 ELSE assigned_to_user_id END,
        reservation_id = CASE WHEN $16::boolean THEN $17 ELSE reservation_id END,
        status = CASE WHEN $18::boolean THEN $19 ELSE status END,
        completed_at = CASE
          WHEN $18::boolean AND $19 = 'completed' THEN COALESCE(completed_at, NOW())
          WHEN $18::boolean AND $19 <> 'completed' THEN NULL
          ELSE completed_at
        END,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    [
      id,
      fields.title != null ? fields.title : null,
      fields.taskType != null ? fields.taskType : null,
      fields.carId !== undefined,
      fields.carId != null ? Number(fields.carId) : null,
      fields.startsAt !== undefined,
      fields.startsAt != null ? fields.startsAt : null,
      fields.dueAt !== undefined,
      fields.dueAt != null ? fields.dueAt : null,
      fields.locationText !== undefined,
      fields.locationText != null ? fields.locationText : null,
      fields.notes !== undefined,
      fields.notes != null ? fields.notes : null,
      fields.assignedToUserId !== undefined,
      fields.assignedToUserId != null ? Number(fields.assignedToUserId) : null,
      fields.reservationId !== undefined,
      fields.reservationId != null ? Number(fields.reservationId) : null,
      fields.status !== undefined,
      fields.status != null ? fields.status : null,
    ]
  );
  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

async function deleteTask(taskId, client = null) {
  const id = Number(taskId);
  const result = await clientQuery(
    client,
    `DELETE FROM calendar_tasks WHERE id = $1 RETURNING *`,
    [id]
  );
  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

async function findReservationById(reservationId, client = null) {
  const id = Number(reservationId);
  if (!Number.isInteger(id) || id <= 0) return null;
  const result = await clientQuery(
    client,
    `
    SELECT r.*, c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.id = $1
    LIMIT 1
    `,
    [id]
  );
  return result.rows[0] || null;
}

async function listAssignedCarIdsForUser(userId, from, to, client = null) {
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid <= 0) return [];
  const result = await clientQuery(
    client,
    `
    SELECT DISTINCT car_id
    FROM calendar_tasks
    WHERE assigned_to_user_id = $1
      AND car_id IS NOT NULL
      AND status <> 'cancelled'
      AND (
        (starts_at IS NOT NULL AND starts_at < $3 AND COALESCE(due_at, starts_at) > $2)
        OR (starts_at IS NULL AND due_at IS NOT NULL AND due_at >= $2 AND due_at < $3)
      )
    `,
    [uid, from, to]
  );
  return result.rows.map((r) => String(r.car_id));
}

async function getDayReservationSections(dateIso, client = null) {
  const pickups = await clientQuery(
    client,
    `
    SELECT r.id, r.car_id, r.status, r.pickup_date, r.return_date, r.full_name, r.email,
           r.phone_number, c.name AS car_name, c.status AS car_status
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      AND r.status NOT IN ('cancelled','expired','refunded','no_show','completed')
    ORDER BY r.pickup_date ASC
    `,
    [dateIso]
  );
  const returns = await clientQuery(
    client,
    `
    SELECT r.id, r.car_id, r.status, r.pickup_date, r.return_date, r.full_name, r.email,
           r.phone_number, c.name AS car_name, c.status AS car_status
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE (r.return_date AT TIME ZONE 'Europe/Sofia')::date = $1::date
      AND r.status NOT IN ('cancelled','expired','refunded','no_show','completed')
    ORDER BY r.return_date ASC
    `,
    [dateIso]
  );
  const paidNotConfirmed = await clientQuery(
    client,
    `
    SELECT r.id, r.car_id, r.status, r.pickup_date, r.full_name, c.name AS car_name
    FROM reservations r
    JOIN cars c ON c.id = r.car_id
    WHERE r.status = 'paid'
      AND (r.pickup_date AT TIME ZONE 'Europe/Sofia')::date <= ($1::date + INTERVAL '3 days')
    ORDER BY r.pickup_date ASC
    LIMIT 50
    `,
    [dateIso]
  );

  return {
    pickups: pickups.rows,
    returns: returns.rows,
    paidNotConfirmed: paidNotConfirmed.rows,
  };
}

async function listInsuranceWarnings(dateIso, client = null) {
  const result = await clientQuery(
    client,
    `
    SELECT id, name, insurance_expiry, technical_inspection_expiry, status
    FROM cars
    WHERE is_deleted = FALSE
      AND (
        (insurance_expiry IS NOT NULL AND insurance_expiry <= ($1::date + INTERVAL '14 days'))
        OR (technical_inspection_expiry IS NOT NULL AND technical_inspection_expiry <= ($1::date + INTERVAL '14 days'))
      )
    ORDER BY name ASC
    `,
    [dateIso]
  );
  return result.rows;
}

module.exports = {
  mapTask,
  listCarsForCalendar,
  listReservationsInRange,
  listManualBlocksInRange,
  listTasksInRange,
  listTasks,
  findTaskById,
  hasAssignedTask,
  createTask,
  updateTaskStatus,
  updateTaskSchedule,
  updateTask,
  deleteTask,
  findBlockById,
  createManualBlock,
  updateManualBlock,
  deleteManualBlock,
  findReservationById,
  listAssignedCarIdsForUser,
  getDayReservationSections,
  listInsuranceWarnings,
};
