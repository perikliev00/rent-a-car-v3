/**
 * SQL repository for calendar_tasks (timeline range, board filters, CRUD).
 *
 * Range overlap treats starts_at/due_at flexibly; tasks without starts use due_at
 * (or created_at on the board list) so undated work still appears.
 */

const { clientQuery } = require('../../../db/transaction');
// Destructure object properties into local variables.
const { mapTask } = require('./calendarTaskMapper');

/**
 * Tasks overlapping a calendar viewport (excludes cancelled by default).
 * @param {{ from: Date|string, to: Date|string, carIds?: Array|null, assignedToUserId?: number|null, includeUnassigned?: boolean }} opts
 */
async function listTasksInRange(
  // Continue the surrounding logic with this statement.
  { from, to, carIds = null, assignedToUserId = null, includeUnassigned = true },
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the params constant.
  const params = [from, to];
  // Overlap: dated tasks use starts/due; undated-with-due use due-only window.
  const where = [
    `(
      (t.starts_at IS NOT NULL AND t.starts_at < $2 AND COALESCE(t.due_at, t.starts_at) > $1)
      OR (t.starts_at IS NULL AND t.due_at IS NOT NULL AND t.due_at >= $1 AND t.due_at < $2)
    )`,
    // Continue the surrounding logic with this statement.
    `t.status <> 'cancelled'`,
  ];

  // Optional assignee filter (VIEW_OWN / staff filter).
  if (assignedToUserId != null) {
    // Call params.push to perform this step.
    params.push(Number(assignedToUserId));
    // Call where.push to perform this step.
    where.push(`t.assigned_to_user_id = $${params.length}`);
  }
  // Car-scoped timeline: include fleet-wide tasks (null car_id) plus matching cars.
  if (Array.isArray(carIds) && carIds.length > 0) {
    // Call params.push to perform this step.
    params.push(carIds.map(Number).filter((n) => Number.isInteger(n) && n > 0));
    // Call where.push to perform this step.
    where.push(`(t.car_id IS NULL OR t.car_id = ANY($${params.length}::bigint[]))`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (!includeUnassigned && assignedToUserId == null) {
    // Call where.push to perform this step.
    where.push(`t.assigned_to_user_id IS NOT NULL`);
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT *
    FROM calendar_tasks t
    WHERE ${where.join(' AND ')}
    ORDER BY COALESCE(t.starts_at, t.due_at) ASC NULLS LAST
    `,
    // Reference the identifier used by the enclosing expression.
    params
  );
  // Return the resulting value to the caller.
  return result.rows;
}

/**
 * Filtered task list for staff dashboards / manager board.
 */
async function listTasks(
  {
    // Update from with the right-hand side value.
    from = null,
    // Update to with the right-hand side value.
    to = null,
    // Update assignedToUserId with the right-hand side value.
    assignedToUserId = null,
    // Update unassigned with the right-hand side value.
    unassigned = false,
    // Update taskType with the right-hand side value.
    taskType = null,
    // Update taskTypes with the right-hand side value.
    taskTypes = null,
    // Update status with the right-hand side value.
    status = null,
    // Update carId with the right-hand side value.
    carId = null,
    // Update includeCancelled with the right-hand side value.
    includeCancelled = false,
  // Continue the surrounding logic with this statement.
  } = {},
  // Update client with the right-hand side value.
  client = null
// Continue the surrounding logic with this statement.
) {
  // Create the params constant.
  const params = [];
  // Create the where constant.
  const where = ['TRUE'];

  // Evaluate the condition and enter the branch when it is true.
  if (from && to) {
    // Call params.push to perform this step.
    params.push(from, to);
    where.push(`(
      (t.starts_at IS NOT NULL AND t.starts_at < $${params.length} AND COALESCE(t.due_at, t.starts_at) > $${params.length - 1})
      OR (t.starts_at IS NULL AND t.due_at IS NOT NULL AND t.due_at >= $${params.length - 1} AND t.due_at < $${params.length})
      OR (t.starts_at IS NULL AND t.due_at IS NULL AND t.created_at >= $${params.length - 1} AND t.created_at < $${params.length})
    )`);
  // Continue the surrounding logic with this statement.
  } else if (from) {
    // Call params.push to perform this step.
    params.push(from);
    // Call where.push to perform this step.
    where.push(`COALESCE(t.due_at, t.starts_at, t.created_at) >= $${params.length}`);
  // Continue the surrounding logic with this statement.
  } else if (to) {
    // Call params.push to perform this step.
    params.push(to);
    // Call where.push to perform this step.
    where.push(`COALESCE(t.starts_at, t.due_at, t.created_at) < $${params.length}`);
  }

  // Evaluate the condition and enter the branch when it is true.
  if (assignedToUserId != null) {
    // Call params.push to perform this step.
    params.push(Number(assignedToUserId));
    // Call where.push to perform this step.
    where.push(`t.assigned_to_user_id = $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (unassigned) {
    // Call where.push to perform this step.
    where.push(`t.assigned_to_user_id IS NULL`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (taskType) {
    // Call params.push to perform this step.
    params.push(taskType);
    // Call where.push to perform this step.
    where.push(`t.task_type = $${params.length}`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (Array.isArray(taskTypes) && taskTypes.length > 0) {
    // Call params.push to perform this step.
    params.push(taskTypes);
    // Call where.push to perform this step.
    where.push(`t.task_type = ANY($${params.length}::text[])`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (status) {
    // Call params.push to perform this step.
    params.push(status);
    // Call where.push to perform this step.
    where.push(`t.status = $${params.length}`);
  // Continue the surrounding logic with this statement.
  } else if (!includeCancelled) {
    // Call where.push to perform this step.
    where.push(`t.status <> 'cancelled'`);
  }
  // Evaluate the condition and enter the branch when it is true.
  if (carId != null) {
    // Call params.push to perform this step.
    params.push(Number(carId));
    // Call where.push to perform this step.
    where.push(`t.car_id = $${params.length}`);
  }

  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Reference the identifier used by the enclosing expression.
    params
  );

  // Return the resulting value to the caller.
  return result.rows.map((row) => ({
    // Call ...mapTask to perform this step.
    ...mapTask(row),
    // Provide the car name field value.
    carName: row.car_name || null,
  }));
}

/** @param {string|number} taskId */
async function findTaskById(taskId, client = null) {
  // Create the id constant.
  const id = Number(taskId);
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(id) || id <= 0) return null;
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `SELECT * FROM calendar_tasks WHERE id = $1 LIMIT 1`,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Return the resulting value to the caller.
  return result.rows[0] || null;
}

/**
 * Whether the user has any task on this reservation (VIEW_OWN detail gate).
 */
async function hasAssignedTask(userId, reservationId, client = null) {
  // Create the uid constant.
  const uid = Number(userId);
  // Create the rid constant.
  const rid = Number(reservationId);
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(uid) || uid <= 0 || !Number.isInteger(rid) || rid <= 0) {
    // Return the resulting value to the caller.
    return false;
  }
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    SELECT 1
    FROM calendar_tasks
    WHERE reservation_id = $1
      AND assigned_to_user_id = $2
    LIMIT 1
    `,
    // Contribute this line to the enclosing declaration or statement.
    [rid, uid]
  );
  // Return the resulting value to the caller.
  return result.rows.length > 0;
}

/** Insert and return mapped task DTO. */
async function createTask(payload, client = null) {
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    INSERT INTO calendar_tasks (
      car_id, reservation_id, task_type, title, notes, location_text,
      starts_at, due_at, status, assigned_to_user_id, created_by_user_id
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    RETURNING *
    `,
    [
      // Continue the surrounding logic with this statement.
      payload.carId != null ? Number(payload.carId) : null,
      // Continue the surrounding logic with this statement.
      payload.reservationId != null ? Number(payload.reservationId) : null,
      // Contribute this line to the enclosing declaration or statement.
      payload.taskType,
      // Contribute this line to the enclosing declaration or statement.
      payload.title,
      // Contribute this line to the enclosing declaration or statement.
      payload.notes || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.locationText || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.startsAt || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.dueAt || null,
      // Contribute this line to the enclosing declaration or statement.
      payload.status || 'pending',
      // Continue the surrounding logic with this statement.
      payload.assignedToUserId != null ? Number(payload.assignedToUserId) : null,
      // Continue the surrounding logic with this statement.
      payload.createdByUserId != null ? Number(payload.createdByUserId) : null,
    ]
  );
  // Return the resulting value to the caller.
  return mapTask(result.rows[0]);
}

/**
 * Set status; stamps completed_at on completed, clears it otherwise.
 */
async function updateTaskStatus(taskId, status, client = null) {
  // Create the id constant.
  const id = Number(taskId);
  // Create the next constant.
  const next = String(status);
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `
    UPDATE calendar_tasks
    SET status = $2::text,
        completed_at = CASE WHEN $2::text = 'completed' THEN COALESCE(completed_at, NOW()) ELSE NULL END,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
    `,
    // Contribute this line to the enclosing declaration or statement.
    [id, next]
  );
  // Return the resulting value to the caller.
  return mapTask(result.rows[0]);
}

/** Drag-move schedule fields only. */
async function updateTaskSchedule(taskId, { startsAt, dueAt, carId }, client = null) {
  // Create the id constant.
  const id = Number(taskId);
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Contribute this line to the enclosing declaration or statement.
      startsAt || null,
      // Contribute this line to the enclosing declaration or statement.
      dueAt || null,
      // Continue the surrounding logic with this statement.
      carId != null ? Number(carId) : null,
    ]
  );
  // Return the resulting value to the caller.
  return mapTask(result.rows[0]);
}

/**
 * Partial update using boolean flags so null clears nullable columns intentionally.
 */
async function updateTask(taskId, fields, client = null) {
  // Create the id constant.
  const id = Number(taskId);
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
      // Contribute this line to the enclosing declaration or statement.
      id,
      // Continue the surrounding logic with this statement.
      fields.title != null ? fields.title : null,
      // Continue the surrounding logic with this statement.
      fields.taskType != null ? fields.taskType : null,
      // Continue the surrounding logic with this statement.
      fields.carId !== undefined,
      // Continue the surrounding logic with this statement.
      fields.carId != null ? Number(fields.carId) : null,
      // Continue the surrounding logic with this statement.
      fields.startsAt !== undefined,
      // Continue the surrounding logic with this statement.
      fields.startsAt != null ? fields.startsAt : null,
      // Continue the surrounding logic with this statement.
      fields.dueAt !== undefined,
      // Continue the surrounding logic with this statement.
      fields.dueAt != null ? fields.dueAt : null,
      // Continue the surrounding logic with this statement.
      fields.locationText !== undefined,
      // Continue the surrounding logic with this statement.
      fields.locationText != null ? fields.locationText : null,
      // Continue the surrounding logic with this statement.
      fields.notes !== undefined,
      // Continue the surrounding logic with this statement.
      fields.notes != null ? fields.notes : null,
      // Continue the surrounding logic with this statement.
      fields.assignedToUserId !== undefined,
      // Continue the surrounding logic with this statement.
      fields.assignedToUserId != null ? Number(fields.assignedToUserId) : null,
      // Continue the surrounding logic with this statement.
      fields.reservationId !== undefined,
      // Continue the surrounding logic with this statement.
      fields.reservationId != null ? Number(fields.reservationId) : null,
      // Continue the surrounding logic with this statement.
      fields.status !== undefined,
      // Continue the surrounding logic with this statement.
      fields.status != null ? fields.status : null,
    ]
  );
  // Return the resulting value to the caller.
  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

/** Hard-delete task row. */
async function deleteTask(taskId, client = null) {
  // Create the id constant.
  const id = Number(taskId);
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
    `DELETE FROM calendar_tasks WHERE id = $1 RETURNING *`,
    // Contribute this line to the enclosing declaration or statement.
    [id]
  );
  // Return the resulting value to the caller.
  return result.rows[0] ? mapTask(result.rows[0]) : null;
}

/**
 * Distinct car ids with assigned tasks in range — scopes VIEW_OWN calendars.
 */
async function listAssignedCarIdsForUser(userId, from, to, client = null) {
  // Create the uid constant.
  const uid = Number(userId);
  // Evaluate the condition and enter the branch when it is true.
  if (!Number.isInteger(uid) || uid <= 0) return [];
  // Create the result constant.
  const result = await clientQuery(
    // Contribute this line to the enclosing declaration or statement.
    client,
    // Continue the surrounding logic with this statement.
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
    // Contribute this line to the enclosing declaration or statement.
    [uid, from, to]
  );
  // Return the resulting value to the caller.
  return result.rows.map((r) => String(r.car_id));
}

// Assign the CommonJS module exports.
module.exports = {
  // Contribute this line to the enclosing declaration or statement.
  listTasksInRange,
  // Contribute this line to the enclosing declaration or statement.
  listTasks,
  // Contribute this line to the enclosing declaration or statement.
  findTaskById,
  // Contribute this line to the enclosing declaration or statement.
  hasAssignedTask,
  // Contribute this line to the enclosing declaration or statement.
  createTask,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  updateTaskSchedule,
  // Contribute this line to the enclosing declaration or statement.
  updateTask,
  // Contribute this line to the enclosing declaration or statement.
  deleteTask,
  // Contribute this line to the enclosing declaration or statement.
  listAssignedCarIdsForUser,
};
