/**
 * Role-based default calendar filters/views for drivers/cleaners/etc.
 */
import { formatISO } from 'date-fns';
import type { CalendarViewMode } from './calendar.types';

/**
 * Apply role-based first paint only when URL has no intentional filter deep-link.
 * Explicit view/date or any filter key means the user (or a link) already chose state.
 *
 * @param params - Current calendar URL search params
 */
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
  // Any filter already in the URL → do not overwrite.
  if (filterKeys.some((k) => params.get(k))) return false;
  const hasExplicitView = params.has('view');
  const hasExplicitDate = params.has('date');
  if (hasExplicitView || hasExplicitDate) return false;
  return true;
}

/**
 * First-paint defaults by role: day ops for frontline staff,
 * paid-only week for accountants, week view for managers.
 *
 * @param user - Session user (roles drive the preset)
 */
export function buildRolePresetParams(
  user: { roles?: string[] } | null | undefined
): URLSearchParams {
  const roles = user?.roles || [];
  const today = formatISO(new Date(), { representation: 'date' });
  const next = new URLSearchParams();

  // Front-desk: day agenda for today.
  if (roles.includes('receptionist')) {
    next.set('view', 'day' satisfies CalendarViewMode);
    next.set('date', today);
    return next;
  }
  // Drivers/cleaners: same day-ops focus.
  if (roles.includes('driver') || roles.includes('cleaner')) {
    next.set('view', 'day');
    next.set('date', today);
    return next;
  }
  // Finance: week view filtered to paid reservations.
  if (roles.includes('accountant')) {
    next.set('view', 'week');
    next.set('date', today);
    next.set('reservationStatus', 'paid');
    return next;
  }
  // Default managers/owners: week view starting today.
  next.set('view', 'week');
  next.set('date', today);
  return next;
}
