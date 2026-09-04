export const TASK_TYPES = [
  'pickup',
  'delivery',
  'return',
  'cleaning',
  'inspection',
  'maintenance_dropoff',
  'maintenance_pickup',
  'document_check',
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

export const TASK_STATUSES = [
  'pending',
  'assigned',
  'in_progress',
  'completed',
  'failed',
  'cancelled',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const DRIVER_TYPES: TaskType[] = [
  'pickup',
  'delivery',
  'return',
  'maintenance_dropoff',
  'maintenance_pickup',
];

export const CLEANER_TYPES: TaskType[] = ['cleaning', 'inspection'];

export const RECEPTIONIST_TYPES: TaskType[] = [
  'document_check',
  'pickup',
  'delivery',
  'return',
];

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  pickup: 'Pickup',
  delivery: 'Delivery',
  return: 'Return',
  cleaning: 'Cleaning',
  inspection: 'Inspection',
  maintenance_dropoff: 'Maintenance dropoff',
  maintenance_pickup: 'Maintenance pickup',
  document_check: 'Document check',
};

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_progress: 'In progress',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

const TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  pending: ['assigned', 'cancelled'],
  assigned: ['in_progress', 'cancelled', 'pending'],
  in_progress: ['completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

export function allowedNextStatuses(
  from: TaskStatus,
  opts: { isManager?: boolean } = {}
): TaskStatus[] {
  const base = [...(TRANSITIONS[from] || [])];
  if (opts.isManager && (from === 'failed' || from === 'cancelled')) {
    if (!base.includes('pending')) base.push('pending');
    if (!base.includes('assigned')) base.push('assigned');
  }
  return base;
}

export function taskTypeOptions() {
  return TASK_TYPES.map((value) => ({ value, label: TASK_TYPE_LABELS[value] }));
}

export function taskStatusOptions() {
  return TASK_STATUSES.map((value) => ({ value, label: TASK_STATUS_LABELS[value] }));
}

export type StaffTask = {
  id: string;
  carId: string | null;
  carName?: string | null;
  reservationId: string | null;
  taskType: TaskType | string;
  title: string;
  notes: string | null;
  locationText: string | null;
  startsAt: string | null;
  dueAt: string | null;
  status: TaskStatus | string;
  assignedToUserId: string | null;
  createdByUserId: string | null;
  completedAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type AssignableStaffUser = {
  id: string;
  email: string;
  role: string;
  roles: { id: string; slug: string; name: string }[];
};
