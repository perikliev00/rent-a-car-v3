import { api } from '../client';
import type {
  CalendarCar,
  CalendarEvent,
  CalendarConflict,
  DayOperationsPayload,
} from '../../pages/admin/calendar/calendar.types';

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
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v) q.set(k, String(v));
  });
  return api(`/api/admin/calendar/events?${q.toString()}`);
}

export async function getCalendarDay(date: string): Promise<DayOperationsPayload> {
  return api(`/api/admin/calendar/day/${date}`);
}

export async function getCalendarEventDetails(id: string): Promise<Record<string, unknown>> {
  return api(`/api/admin/calendar/events/${encodeURIComponent(id)}/details`);
}

export async function moveCalendarEvent(
  id: string,
  body: { start: string; end: string; carId?: string; force?: boolean }
): Promise<{ events: CalendarEvent[] }> {
  return api(`/api/admin/calendar/events/${encodeURIComponent(id)}/move`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function resizeCalendarEvent(
  id: string,
  body: { start: string; end: string; carId?: string; force?: boolean }
): Promise<{ events: CalendarEvent[] }> {
  return api(`/api/admin/calendar/events/${encodeURIComponent(id)}/resize`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

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

export async function deleteCalendarBlock(id: string): Promise<{ id: string; deleted: boolean }> {
  return api(`/api/admin/calendar/manual-events/${id}`, { method: 'DELETE' });
}

export async function createCalendarTask(body: Record<string, unknown>): Promise<{
  event: CalendarEvent;
}> {
  return api('/api/admin/calendar/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updateCalendarTask(
  id: string,
  body: Record<string, unknown>
): Promise<{ task: unknown }> {
  return api(`/api/admin/calendar/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deleteCalendarTask(id: string): Promise<{ id: string; deleted: boolean }> {
  return api(`/api/admin/calendar/tasks/${id}`, { method: 'DELETE' });
}

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

export async function updateCalendarTaskStatus(
  id: string,
  status: string
): Promise<{ task: unknown }> {
  return api(`/api/admin/calendar/tasks/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

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
  const q = new URLSearchParams();
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  if (params.assignee) q.set('assignee', params.assignee);
  if (params.type) q.set('type', params.type);
  if (params.types?.length) q.set('types', params.types.join(','));
  if (params.status) q.set('status', params.status);
  if (params.carId) q.set('carId', params.carId);
  if (params.unassigned) q.set('unassigned', 'true');
  if (params.includeCancelled) q.set('includeCancelled', 'true');
  const qs = q.toString();
  return api(`/api/admin/calendar/tasks${qs ? `?${qs}` : ''}`);
}

export async function getAssignableStaff(): Promise<{
  users: import('../../pages/admin/tasks/taskDomain').AssignableStaffUser[];
}> {
  return api('/api/admin/calendar/assignable-staff');
}

export async function getCalendarConflicts(
  from: string,
  to: string
): Promise<{ conflicts: CalendarConflict[] }> {
  const q = new URLSearchParams({ from, to });
  return api(`/api/admin/calendar/conflicts?${q.toString()}`);
}

export type { CalendarConflict };
