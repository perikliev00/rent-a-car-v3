/**
 * Role-based default calendar filters/views for drivers/cleaners/etc.
 */
import { formatISO } from 'date-fns';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarViewMode } from './calendar.types';

/**
 * Apply role-based first paint only when URL has no intentional filter deep-link.
 * Explicit view/date or any filter key means the user (or a link) already chose state.
 *
 * @param params - Current calendar URL search params
 */
export function shouldApplyRolePreset(params: URLSearchParams): boolean {
  // Create the filter keys constant.
  const filterKeys = [
    // Supply the literal value used by the enclosing expression.
    'categoryId',
    // Supply the literal value used by the enclosing expression.
    'transmission',
    // Supply the literal value used by the enclosing expression.
    'fuelType',
    // Supply the literal value used by the enclosing expression.
    'carStatus',
    // Supply the literal value used by the enclosing expression.
    'location',
    // Supply the literal value used by the enclosing expression.
    'reservationStatus',
    // Supply the literal value used by the enclosing expression.
    'eventType',
    // Supply the literal value used by the enclosing expression.
    'staffUserId',
  ];
  // Any filter already in the URL → do not overwrite.
  if (filterKeys.some((k) => params.get(k))) return false;
  // Create the has explicit view constant.
  const hasExplicitView = params.has('view');
  // Create the has explicit date constant.
  const hasExplicitDate = params.has('date');
  // Evaluate the condition and enter the branch when it is true.
  if (hasExplicitView || hasExplicitDate) return false;
  // Return the resulting value to the caller.
  return true;
}

/**
 * First-paint defaults by role: day ops for frontline staff,
 * paid-only week for accountants, week view for managers.
 *
 * @param user - Session user (roles drive the preset)
 */
export function buildRolePresetParams(
  // Provide the user field value.
  user: { roles?: string[] } | null | undefined
// Continue the surrounding logic with this statement.
): URLSearchParams {
  // Create the roles constant.
  const roles = user?.roles || [];
  // Create the today constant.
  const today = formatISO(new Date(), { representation: 'date' });
  // Create the next constant.
  const next = new URLSearchParams();

  // Front-desk: day agenda for today.
  if (roles.includes('receptionist')) {
    // Call next.set to perform this step.
    next.set('view', 'day' satisfies CalendarViewMode);
    // Call next.set to perform this step.
    next.set('date', today);
    // Return the resulting value to the caller.
    return next;
  }
  // Drivers/cleaners: same day-ops focus.
  if (roles.includes('driver') || roles.includes('cleaner')) {
    // Call next.set to perform this step.
    next.set('view', 'day');
    // Call next.set to perform this step.
    next.set('date', today);
    // Return the resulting value to the caller.
    return next;
  }
  // Finance: week view filtered to paid reservations.
  if (roles.includes('accountant')) {
    // Call next.set to perform this step.
    next.set('view', 'week');
    // Call next.set to perform this step.
    next.set('date', today);
    // Call next.set to perform this step.
    next.set('reservationStatus', 'paid');
    // Return the resulting value to the caller.
    return next;
  }
  // Default managers/owners: week view starting today.
  next.set('view', 'week');
  // Call next.set to perform this step.
  next.set('date', today);
  // Return the resulting value to the caller.
  return next;
}
