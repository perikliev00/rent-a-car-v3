/**
 * Fleet calendar admin APIs: events, day ops, drag/resize moves,
 * blocks/tasks, conflicts, and reservation cancel from the calendar.
 *
 * Move/resize/block creates accept `force` to override conflict checks
 * after the ConflictWarningModal confirmation flow.
 */
import { api } from '../client';
import type {
  CalendarCar,
  CalendarEvent,
  CalendarConflict,
  DayOperationsPayload,
} from '../../pages/admin/calendar/calendar.types';

/**
 * Load cars + events for the timeline/month grid in a date range.
 * Empty filter values are omitted so the API applies its defaults.
 *
 * @param params.from - Range start (ISO / API date string)
 * @param params.to - Range end (ISO / API date string)
 * @param params.density - Optional UI density hint forwarded to the API
 * @param params.categoryId - Optional car category filter
 * @param params.transmission - Optional transmission filter
 * @param params.fuelType - Optional fuel-type filter
 * @param params.carStatus - Optional fleet status filter
 * @param params.location - Optional pickup/location filter
 * @param params.reservationStatus - Optional reservation status filter
 * @param params.eventType - Optional event-type filter (reservation/block/task)
 * @param params.staffUserId - Optional assignee filter for staff tasks
 */
export async function getCalendarEvents(params: {
  from: string;
  to: string;
  density?: string;
  categoryId?: string;
  transmission?: string;
  fuelType?: string;
  carStatus?: string;
  location?: string;
  reservationStatus?: string;
  eventType?: string;
  staffUserId?: string;
}): Promise<{ cars: CalendarCar[]; events: CalendarEvent[]; density: string }> {
  // Build query string from the params object.
  const q = new URLSearchParams();
  // Skip falsy values so unset filters do not override API defaults.
  Object.entries(params).forEach(([k, v]) => {
    if (v) q.set(k, String(v));
  });
  return api(`/api/admin/calendar/events?${q.toString()}`);
}

/**
 * Day-operations payload for a single calendar date (pickups, returns, tasks).
 * @param date - Calendar day key expected by the API (typically YYYY-MM-DD)
 */
export async function getCalendarDay(date: string): Promise<DayOperationsPayload> {
  return api(`/api/admin/calendar/day/${date}`);
}

/**
 * Detailed payload for one calendar event (reservation, block, or task).
 * Encodes the id so composite event ids remain safe in the URL path.
 * @param id - Calendar event id
 */
export async function getCalendarEventDetails(id: string): Promise<Record<string, unknown>> {
  return api(`/api/admin/calendar/events/${encodeURIComponent(id)}/details`);
}

/**
 * Drag-to-reschedule an event onto a new start/end (and optionally another car).
 * Pass `force: true` only after the user acknowledges conflicts in the UI modal.
 *
 * @param id - Calendar event id
 * @param body.start - New start timestamp
 * @param body.end - New end timestamp
 * @param body.carId - Optional target car when dragging across rows
 * @param body.force - When true, server skips soft conflict rejection
 */
export async function moveCalendarEvent(
  id: string,
  body: { start: string; end: string; carId?: string; force?: boolean }
): Promise<{ events: CalendarEvent[] }> {
  return api(`/api/admin/calendar/events/${encodeURIComponent(id)}/move`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Edge-resize to change an event’s duration; same conflict/`force` contract as move.
 *
 * @param id - Calendar event id
 * @param body.start - New start timestamp
 * @param body.end - New end timestamp
 * @param body.carId - Optional car id when resize implies a row change
 * @param body.force - When true, server skips soft conflict rejection
 */
export async function resizeCalendarEvent(
  id: string,
  body: { start: string; end: string; carId?: string; force?: boolean }
): Promise<{ events: CalendarEvent[] }> {
  return api(`/api/admin/calendar/events/${encodeURIComponent(id)}/resize`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Create a manual block (maintenance / unavailable window) on a car.
 * May return a conflict response unless `force` is set after UI confirmation.
 *
 * @param body.carId - Target car
 * @param body.start - Block start
 * @param body.end - Block end
 * @param body.blockType - Optional block category used by ops UI
 * @param body.reason - Optional short reason shown in details
 * @param body.notes - Optional free-text notes
 * @param body.force - Override soft conflicts after acknowledgment
 */
export async function createCalendarBlock(body: {
  carId: string | number;
  start: string;
  end: string;
  blockType?: string;
  reason?: string;
  notes?: string;
  force?: boolean;
}): Promise<{ event: CalendarEvent }> {
  return api('/api/admin/calendar/manual-events', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Update an existing manual block’s schedule, car, or metadata.
 *
 * @param id - Manual-event / block id
 * @param body - Partial fields to patch; `force` mirrors create/move conflict handling
 */
export async function updateCalendarBlock(
  id: string,
  body: {
    carId?: string | number;
    start?: string;
    end?: string;
    blockType?: string;
    reason?: string | null;
    notes?: string | null;
    force?: boolean;
  }
): Promise<{ event: CalendarEvent }> {
  return api(`/api/admin/calendar/manual-events/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Delete a manual block by id.
 * @param id - Manual-event / block id
 */
export async function deleteCalendarBlock(id: string): Promise<{ id: string; deleted: boolean }> {
  return api(`/api/admin/calendar/manual-events/${id}`, { method: 'DELETE' });
}

/**
 * Create a staff task event on the calendar (cleaning, delivery, etc.).
 * Body shape is validated server-side; UI sends task-domain fields.
 * @param body - Task create payload
 */
export async function createCalendarTask(body: Record<string, unknown>): Promise<{
  event: CalendarEvent;
}> {
  return api('/api/admin/calendar/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

/**
 * Patch task fields (schedule, assignee, notes, type, …).
 * @param id - Task id
 * @param body - Partial task update payload
 */
export async function updateCalendarTask(
  id: string,
  body: Record<string, unknown>
): Promise<{ task: unknown }> {
  return api(`/api/admin/calendar/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

/**
 * Delete a calendar task by id.
 * @param id - Task id
 */
export async function deleteCalendarTask(id: string): Promise<{ id: string; deleted: boolean }> {
  return api(`/api/admin/calendar/tasks/${id}`, { method: 'DELETE' });
}

/**
 * Cancel a reservation from the calendar UI (ops shortcut).
 * Returns before/after status so the UI can refresh and show what changed.
 * @param id - Reservation id (encoded for path safety)
 */
export async function cancelCalendarReservation(id: string): Promise<{
  reservation: unknown;
  changed: boolean;
  oldStatus: string;
  newStatus: string;
}> {
  return api(`/api/admin/calendar/reservations/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
  });
}

/**
 * Transition a task to a new status (domain rules enforced on the server).
 * @param id - Task id
 * @param status - Target status slug from the task domain
 */
export async function updateCalendarTaskStatus(
  id: string,
  status: string
): Promise<{ task: unknown }> {
  return api(`/api/admin/calendar/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

/**
 * List staff tasks with optional filters for the tasks pages / calendar side panels.
 * Multi-value `types` is sent as a comma-separated query param.
 *
 * @param params.from - Optional range start
 * @param params.to - Optional range end
 * @param params.assignee - Optional assignee user id
 * @param params.type - Optional single task type
 * @param params.types - Optional list of task types (joined for the query string)
 * @param params.status - Optional status filter
 * @param params.carId - Optional car filter
 * @param params.unassigned - When true, request only unassigned tasks
 * @param params.includeCancelled - When true, include cancelled tasks in the result
 */
export async function listCalendarTasks(params: {
  from?: string;
  to?: string;
  assignee?: string;
  type?: string;
  types?: string[];
  status?: string;
  carId?: string;
  unassigned?: boolean;
  includeCancelled?: boolean;
}): Promise<{ tasks: import('../../pages/admin/tasks/taskDomain').StaffTask[] }> {
  // Only set keys that are present so omitted filters stay unconstrained.
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.assignee) q.set('assignee', params.assignee);
  if (params.type) q.set('type', params.type);
  // API expects a single comma-separated `types` value.
  if (params.types?.length) q.set('types', params.types.join(','));
  if (params.status) q.set('status', params.status);
  if (params.carId) q.set('carId', params.carId);
  // Booleans are sent as the string "true" when enabled.
  if (params.unassigned) q.set('unassigned', 'true');
  if (params.includeCancelled) q.set('includeCancelled', 'true');
  const qs = q.toString();
  // Avoid a trailing `?` when no filters were applied.
  return api(`/api/admin/calendar/tasks${qs ? `?${qs}` : ''}`);
}

/**
 * Staff users that can be assigned to calendar tasks (RBAC-filtered server-side).
 */
export async function getAssignableStaff(): Promise<{
  users: import('../../pages/admin/tasks/taskDomain').AssignableStaffUser[];
}> {
  return api('/api/admin/calendar/assignable-staff');
}

/**
 * Overlapping events in a range — used for conflict badges and warning modals.
 * @param from - Range start
 * @param to - Range end
 */
export async function getCalendarConflicts(
  from: string,
  to: string
): Promise<{ conflicts: CalendarConflict[] }> {
  const q = new URLSearchParams({ from, to });
  return api(`/api/admin/calendar/conflicts?${q.toString()}`);
}

/** Re-export conflict type for consumers that import from this API module. */
export type { CalendarConflict };
