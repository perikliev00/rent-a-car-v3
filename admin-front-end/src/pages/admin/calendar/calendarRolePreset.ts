import { formatISO } from 'date-fns';
import type { CalendarViewMode } from './calendar.types';

/** Apply role-based first paint only when URL has no intentional filter deep-link. */
export function shouldApplyRolePreset(params: URLSearchParams): boolean {
  const filterKeys = [
    'categoryId',
    'transmission',
    'fuelType',
    'carStatus',
    'location',
    'reservationStatus',
    'eventType',
    'staffUserId',
  ];
  if (filterKeys.some((k) => params.get(k))) return false;
  const hasExplicitView = params.has('view');
  const hasExplicitDate = params.has('date');
  if (hasExplicitView || hasExplicitDate) return false;
  return true;
}

export function buildRolePresetParams(
  user: { roles?: string[] } | null | undefined
): URLSearchParams {
  const roles = user?.roles || [];
  const today = formatISO(new Date(), { representation: 'date' });
  const next = new URLSearchParams();

  if (roles.includes('receptionist')) {
    next.set('view', 'day' satisfies CalendarViewMode);
    next.set('date', today);
    return next;
  }
  if (roles.includes('driver') || roles.includes('cleaner')) {
    next.set('view', 'day');
    next.set('date', today);
    return next;
  }
  if (roles.includes('accountant')) {
    next.set('view', 'week');
    next.set('date', today);
    next.set('reservationStatus', 'paid');
    return next;
  }
  next.set('view', 'week');
  next.set('date', today);
  return next;
}
