/**
 * Staff task domain types, labels, and role-type mappings.
 */
export const TASK_TYPES = [
  // Supply the literal value used by the enclosing expression.
  'pickup',
  // Supply the literal value used by the enclosing expression.
  'delivery',
  // Supply the literal value used by the enclosing expression.
  'return',
  // Supply the literal value used by the enclosing expression.
  'cleaning',
  // Supply the literal value used by the enclosing expression.
  'inspection',
  // Supply the literal value used by the enclosing expression.
  'maintenance_dropoff',
  // Supply the literal value used by the enclosing expression.
  'maintenance_pickup',
  // Supply the literal value used by the enclosing expression.
  'document_check',
// Apply the TypeScript type assertion for this value.
] as const;

// Export the task type type.
export type TaskType = (typeof TASK_TYPES)[number];

// Export the task statuses const.
export const TASK_STATUSES = [
  // Supply the literal value used by the enclosing expression.
  'pending',
  // Supply the literal value used by the enclosing expression.
  'assigned',
  // Supply the literal value used by the enclosing expression.
  'in_progress',
  // Supply the literal value used by the enclosing expression.
  'completed',
  // Supply the literal value used by the enclosing expression.
  'failed',
  // Supply the literal value used by the enclosing expression.
  'cancelled',
// Apply the TypeScript type assertion for this value.
] as const;

// Export the task status type.
export type TaskStatus = (typeof TASK_STATUSES)[number];

// Export the driver types const.
export const DRIVER_TYPES: TaskType[] = [
  // Supply the literal value used by the enclosing expression.
  'pickup',
  // Supply the literal value used by the enclosing expression.
  'delivery',
  // Supply the literal value used by the enclosing expression.
  'return',
  // Supply the literal value used by the enclosing expression.
  'maintenance_dropoff',
  // Supply the literal value used by the enclosing expression.
  'maintenance_pickup',
];

// Export the cleaner types const.
export const CLEANER_TYPES: TaskType[] = ['cleaning', 'inspection'];

// Export the receptionist types const.
export const RECEPTIONIST_TYPES: TaskType[] = [
  // Supply the literal value used by the enclosing expression.
  'document_check',
  // Supply the literal value used by the enclosing expression.
  'pickup',
  // Supply the literal value used by the enclosing expression.
  'delivery',
  // Supply the literal value used by the enclosing expression.
  'return',
];

// Export the task type labels const.
export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  // Provide the pickup field value.
  pickup: 'Pickup',
  // Provide the delivery field value.
  delivery: 'Delivery',
  // Return the resulting value to the caller.
  return: 'Return',
  // Provide the cleaning field value.
  cleaning: 'Cleaning',
  // Provide the inspection field value.
  inspection: 'Inspection',
  // Provide the maintenance dropoff field value.
  maintenance_dropoff: 'Maintenance dropoff',
  // Provide the maintenance pickup field value.
  maintenance_pickup: 'Maintenance pickup',
  // Provide the document check field value.
  document_check: 'Document check',
};

// Export the task status labels const.
export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  // Provide the pending field value.
  pending: 'Pending',
  // Provide the assigned field value.
  assigned: 'Assigned',
  // Provide the in progress field value.
  in_progress: 'In progress',
  // Provide the completed field value.
  completed: 'Completed',
  // Provide the failed field value.
  failed: 'Failed',
  // Provide the cancelled field value.
  cancelled: 'Cancelled',
};

// Continue the surrounding logic with this statement.
const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  // Provide the pending field value.
  pending: ['assigned', 'cancelled'],
  // Provide the assigned field value.
  assigned: ['in_progress', 'cancelled', 'pending'],
  // Provide the in progress field value.
  in_progress: ['completed', 'failed', 'cancelled'],
  // Provide the completed field value.
  completed: [],
  // Provide the failed field value.
  failed: [],
  // Provide the cancelled field value.
  cancelled: [],
};

/**
 * Legal next statuses from `from`, with manager reopen of failed/cancelled.
 *
 * @param from - Current task status
 * @param opts.isManager - When true, allow reopen to pending/assigned
 */
export function allowedNextStatuses(
  // Provide the from field value.
  from: TaskStatus,
  // Provide the opts field value.
  opts: { isManager?: boolean } = {}
// Continue the surrounding logic with this statement.
): TaskStatus[] {
  // Create the base constant.
  const base = [...(TRANSITIONS[from] || [])];
  // Managers can reopen terminal failure/cancel states into the workflow again.
  if (opts.isManager && (from === 'failed' || from === 'cancelled')) {
    // Evaluate the condition and enter the branch when it is true.
    if (!base.includes('pending')) base.push('pending');
    // Evaluate the condition and enter the branch when it is true.
    if (!base.includes('assigned')) base.push('assigned');
  }
  // Return the resulting value to the caller.
  return base;
}

/** Select options for all task types. */
export function taskTypeOptions() {
  // Return the resulting value to the caller.
  return TASK_TYPES.map((value) => ({ value, label: TASK_TYPE_LABELS[value] }));
}

/** Select options for all task statuses. */
export function taskStatusOptions() {
  // Return the resulting value to the caller.
  return TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABELS[value] }));
}

// Export the staff task type.
export type StaffTask = {
  // Provide the id field value.
  id: string;
  // Provide the car id field value.
  carId: string | null;
  // Contribute this line to the enclosing declaration or statement.
  carName?: string | null;
  // Provide the reservation id field value.
  reservationId: string | null;
  // Provide the task type field value.
  taskType: TaskType | string;
  // Provide the title field value.
  title: string;
  // Provide the notes field value.
  notes: string | null;
  // Provide the location text field value.
  locationText: string | null;
  // Provide the starts at field value.
  startsAt: string | null;
  // Provide the due at field value.
  dueAt: string | null;
  // Provide the status field value.
  status: TaskStatus | string;
  // Provide the assigned to user id field value.
  assignedToUserId: string | null;
  // Provide the created by user id field value.
  createdByUserId: string | null;
  // Provide the completed at field value.
  completedAt: string | null;
  // Contribute this line to the enclosing declaration or statement.
  createdAt?: string;
  // Contribute this line to the enclosing declaration or statement.
  updatedAt?: string;
};

// Export the assignable staff user type.
export type AssignableStaffUser = {
  // Provide the id field value.
  id: string;
  // Provide the email field value.
  email: string;
  // Provide the role field value.
  role: string;
  // Provide the roles field value.
  roles: { id: string; slug: string; name: string }[];
};
