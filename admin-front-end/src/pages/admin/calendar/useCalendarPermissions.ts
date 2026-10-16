/**
 * RBAC flags for calendar view/edit/assign/force actions.
 */
import type { User } from '../../../types/api';
import { hasPermission } from '../../../auth/permissions';

/**
 * Derives calendar capability flags from the current user's RBAC permissions.
 * `ownOnly` means the user may see their assigned tasks but not the full fleet grid.
 *
 * @param user - Session user (or null while loading)
 */
export function useCalendarPermissions(user: User | null | undefined) {
  const canView =
    hasPermission(user, 'can_view_calendar') ||
    hasPermission(user, 'can_view_own_calendar_tasks');
  const canMove = hasPermission(user, 'can_move_calendar_reservations');
  const canResize = hasPermission(user, 'can_resize_calendar_reservations');
  const canCreateTasks = hasPermission(user, 'can_create_calendar_tasks');
  const canCreateBlocks = hasPermission(user, 'can_create_calendar_blocks');
  const canAssign = hasPermission(user, 'can_assign_calendar_staff');
  /** Required to confirm ConflictWarningModal force overrides. */
  const canOverride = hasPermission(user, 'can_override_calendar_conflicts');

  // Staff with only own-task visibility (drivers/cleaners) skip fleet-wide filters.
  const ownOnly =
    !hasPermission(user, 'can_view_calendar') &&
    hasPermission(user, 'can_view_own_calendar_tasks');

  return {
    canView,
    canMove,
    canResize,
    canCreateTasks,
    canCreateBlocks,
    canAssign,
    canOverride,
    ownOnly,
  };
}
