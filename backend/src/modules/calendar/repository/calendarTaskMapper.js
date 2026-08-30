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

module.exports = { mapTask };
