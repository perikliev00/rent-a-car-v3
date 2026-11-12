/**
 * Maps calendar_tasks DB rows to camelCase API task DTOs.
 */

/**
 * @param {object|null|undefined} row
 * @returns {object|null}
 */
function mapTask(row) {
  // Evaluate the condition and enter the branch when it is true.
  if (!row) return null;
  // Return the resulting value to the caller.
  return {
    // Provide the id field value.
    id: String(row.id),
    // Provide the car id field value.
    carId: row.car_id != null ? String(row.car_id) : null,
    // Provide the reservation id field value.
    reservationId: row.reservation_id != null ? String(row.reservation_id) : null,
    // Provide the task type field value.
    taskType: row.task_type,
    // Provide the title field value.
    title: row.title,
    // Provide the notes field value.
    notes: row.notes || null,
    // Provide the location text field value.
    locationText: row.location_text || null,
    // Provide the starts at field value.
    startsAt: row.starts_at,
    // Provide the due at field value.
    dueAt: row.due_at,
    // Provide the status field value.
    status: row.status,
    // Provide the assigned to user id field value.
    assignedToUserId: row.assigned_to_user_id != null ? String(row.assigned_to_user_id) : null,
    // Provide the created by user id field value.
    createdByUserId: row.created_by_user_id != null ? String(row.created_by_user_id) : null,
    // Provide the completed at field value.
    completedAt: row.completed_at,
    // Provide the created at field value.
    createdAt: row.created_at,
    // Provide the updated at field value.
    updatedAt: row.updated_at,
  };
}

// Assign the CommonJS module exports.
module.exports = { mapTask };
