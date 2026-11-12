/**
 * Fleet calendar admin APIs: events, day ops, drag/resize moves,
 * blocks/tasks, conflicts, and reservation cancel from the calendar.
 *
 * Move/resize/block creates accept `force` to override conflict checks
 * after the ConflictWarningModal confirmation flow.
 */
import { api } from '../client';
// Contribute this line to the enclosing declaration or statement.
import type {
  // Contribute this line to the enclosing declaration or statement.
  CalendarCar,
  // Contribute this line to the enclosing declaration or statement.
  CalendarEvent,
  // Contribute this line to the enclosing declaration or statement.
  CalendarConflict,
  // Contribute this line to the enclosing declaration or statement.
  DayOperationsPayload,
// Contribute this line to the enclosing declaration or statement.
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
  // Provide the from field value.
  from: string;
  // Provide the to field value.
  to: string;
  // Contribute this line to the enclosing declaration or statement.
  density?: string;
  // Contribute this line to the enclosing declaration or statement.
  categoryId?: string;
  // Contribute this line to the enclosing declaration or statement.
  transmission?: string;
  // Contribute this line to the enclosing declaration or statement.
  fuelType?: string;
  // Contribute this line to the enclosing declaration or statement.
  carStatus?: string;
  // Contribute this line to the enclosing declaration or statement.
  location?: string;
  // Contribute this line to the enclosing declaration or statement.
  reservationStatus?: string;
  // Contribute this line to the enclosing declaration or statement.
  eventType?: string;
  // Contribute this line to the enclosing declaration or statement.
  staffUserId?: string;
// Continue the surrounding logic with this statement.
}): Promise<{ cars: CalendarCar[]; events: CalendarEvent[]; density: string }> {
  // Build query string from the params object.
  const q = new URLSearchParams();
  // Skip falsy values so unset filters do not override API defaults.
  Object.entries(params).forEach(([k, v]) => {
    // Evaluate the condition and enter the branch when it is true.
    if (v) q.set(k, String(v));
  });
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/events?${q.toString()}`);
}

/**
 * Day-operations payload for a single calendar date (pickups, returns, tasks).
 * @param date - Calendar day key expected by the API (typically YYYY-MM-DD)
 */
export async function getCalendarDay(date: string): Promise<DayOperationsPayload> {
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/day/${date}`);
}

/**
 * Detailed payload for one calendar event (reservation, block, or task).
 * Encodes the id so composite event ids remain safe in the URL path.
 * @param id - Calendar event id
 */
export async function getCalendarEventDetails(id: string): Promise<Record<string, unknown>> {
  // Return the resulting value to the caller.
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
  // Provide the id field value.
  id: string,
  // Provide the body field value.
  body: { start: string; end: string; carId?: string; force?: boolean }
// Continue the surrounding logic with this statement.
): Promise<{ events: CalendarEvent[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/events/${encodeURIComponent(id)}/move`, {
    // Provide the method field value.
    method: 'PATCH',
    // Provide the body field value.
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
  // Provide the id field value.
  id: string,
  // Provide the body field value.
  body: { start: string; end: string; carId?: string; force?: boolean }
// Continue the surrounding logic with this statement.
): Promise<{ events: CalendarEvent[] }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/events/${encodeURIComponent(id)}/resize`, {
    // Provide the method field value.
    method: 'PATCH',
    // Provide the body field value.
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
  // Provide the car id field value.
  carId: string | number;
  // Provide the start field value.
  start: string;
  // Provide the end field value.
  end: string;
  // Contribute this line to the enclosing declaration or statement.
  blockType?: string;
  // Contribute this line to the enclosing declaration or statement.
  reason?: string;
  // Contribute this line to the enclosing declaration or statement.
  notes?: string;
  // Contribute this line to the enclosing declaration or statement.
  force?: boolean;
// Continue the surrounding logic with this statement.
}): Promise<{ event: CalendarEvent }> {
  // Return the resulting value to the caller.
  return api('/api/admin/calendar/manual-events', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
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
  // Provide the id field value.
  id: string,
  // Provide the body field value.
  body: {
    // Contribute this line to the enclosing declaration or statement.
    carId?: string | number;
    // Contribute this line to the enclosing declaration or statement.
    start?: string;
    // Contribute this line to the enclosing declaration or statement.
    end?: string;
    // Contribute this line to the enclosing declaration or statement.
    blockType?: string;
    // Contribute this line to the enclosing declaration or statement.
    reason?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    notes?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    force?: boolean;
  }
// Continue the surrounding logic with this statement.
): Promise<{ event: CalendarEvent }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/manual-events/${id}`, {
    // Provide the method field value.
    method: 'PATCH',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}

/**
 * Delete a manual block by id.
 * @param id - Manual-event / block id
 */
export async function deleteCalendarBlock(id: string): Promise<{ id: string; deleted: boolean }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/manual-events/${id}`, { method: 'DELETE' });
}

/**
 * Create a staff task event on the calendar (cleaning, delivery, etc.).
 * Body shape is validated server-side; UI sends task-domain fields.
 * @param body - Task create payload
 */
export async function createCalendarTask(body: Record<string, unknown>): Promise<{
  // Provide the event field value.
  event: CalendarEvent;
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api('/api/admin/calendar/tasks', {
    // Provide the method field value.
    method: 'POST',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}

/**
 * Patch task fields (schedule, assignee, notes, type, …).
 * @param id - Task id
 * @param body - Partial task update payload
 */
export async function updateCalendarTask(
  // Provide the id field value.
  id: string,
  // Provide the body field value.
  body: Record<string, unknown>
// Continue the surrounding logic with this statement.
): Promise<{ task: unknown }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/tasks/${id}`, {
    // Provide the method field value.
    method: 'PATCH',
    // Provide the body field value.
    body: JSON.stringify(body),
  });
}

/**
 * Delete a calendar task by id.
 * @param id - Task id
 */
export async function deleteCalendarTask(id: string): Promise<{ id: string; deleted: boolean }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/tasks/${id}`, { method: 'DELETE' });
}

/**
 * Cancel a reservation from the calendar UI (ops shortcut).
 * Returns before/after status so the UI can refresh and show what changed.
 * @param id - Reservation id (encoded for path safety)
 */
export async function cancelCalendarReservation(id: string): Promise<{
  // Provide the reservation field value.
  reservation: unknown;
  // Provide the changed field value.
  changed: boolean;
  // Provide the old status field value.
  oldStatus: string;
  // Provide the new status field value.
  newStatus: string;
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/reservations/${encodeURIComponent(id)}/cancel`, {
    // Provide the method field value.
    method: 'POST',
  });
}

/**
 * Transition a task to a new status (domain rules enforced on the server).
 * @param id - Task id
 * @param status - Target status slug from the task domain
 */
export async function updateCalendarTaskStatus(
  // Provide the id field value.
  id: string,
  // Provide the status field value.
  status: string
// Continue the surrounding logic with this statement.
): Promise<{ task: unknown }> {
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/tasks/${id}/status`, {
    // Provide the method field value.
    method: 'PATCH',
    // Provide the body field value.
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
  // Contribute this line to the enclosing declaration or statement.
  from?: string;
  // Contribute this line to the enclosing declaration or statement.
  to?: string;
  // Contribute this line to the enclosing declaration or statement.
  assignee?: string;
  // Contribute this line to the enclosing declaration or statement.
  type?: string;
  // Contribute this line to the enclosing declaration or statement.
  types?: string[];
  // Contribute this line to the enclosing declaration or statement.
  status?: string;
  // Contribute this line to the enclosing declaration or statement.
  carId?: string;
  // Contribute this line to the enclosing declaration or statement.
  unassigned?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  includeCancelled?: boolean;
// Continue the surrounding logic with this statement.
}): Promise<{ tasks: import('../../pages/admin/tasks/taskDomain').StaffTask[] }> {
  // Only set keys that are present so omitted filters stay unconstrained.
  const q = new URLSearchParams();
  // Evaluate the condition and enter the branch when it is true.
  if (params.from) q.set('from', params.from);
  // Evaluate the condition and enter the branch when it is true.
  if (params.to) q.set('to', params.to);
  // Evaluate the condition and enter the branch when it is true.
  if (params.assignee) q.set('assignee', params.assignee);
  // Evaluate the condition and enter the branch when it is true.
  if (params.type) q.set('type', params.type);
  // API expects a single comma-separated `types` value.
  if (params.types?.length) q.set('types', params.types.join(','));
  // Evaluate the condition and enter the branch when it is true.
  if (params.status) q.set('status', params.status);
  // Evaluate the condition and enter the branch when it is true.
  if (params.carId) q.set('carId', params.carId);
  // Booleans are sent as the string "true" when enabled.
  if (params.unassigned) q.set('unassigned', 'true');
  // Evaluate the condition and enter the branch when it is true.
  if (params.includeCancelled) q.set('includeCancelled', 'true');
  // Create the qs constant.
  const qs = q.toString();
  // Avoid a trailing `?` when no filters were applied.
  return api(`/api/admin/calendar/tasks${qs ? `?${qs}` : ''}`);
}

/**
 * Staff users that can be assigned to calendar tasks (RBAC-filtered server-side).
 */
export async function getAssignableStaff(): Promise<{
  // Provide the users field value.
  users: import('../../pages/admin/tasks/taskDomain').AssignableStaffUser[];
// Continue the surrounding logic with this statement.
}> {
  // Return the resulting value to the caller.
  return api('/api/admin/calendar/assignable-staff');
}

/**
 * Overlapping events in a range — used for conflict badges and warning modals.
 * @param from - Range start
 * @param to - Range end
 */
export async function getCalendarConflicts(
  // Provide the from field value.
  from: string,
  // Provide the to field value.
  to: string
// Continue the surrounding logic with this statement.
): Promise<{ conflicts: CalendarConflict[] }> {
  // Create the q constant.
  const q = new URLSearchParams({ from, to });
  // Return the resulting value to the caller.
  return api(`/api/admin/calendar/conflicts?${q.toString()}`);
}

/** Re-export conflict type for consumers that import from this API module. */
export type { CalendarConflict };
