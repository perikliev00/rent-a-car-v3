import type { User } from '../../../types/api';
import { hasPermission } from '../../../auth/permissions';

export function useCalendarPermissions(user: User | null | undefined) {
  const canView =
    hasPermission(user, 'can_view_calendar') ||
    hasPermission(user, 'can_view_own_calendar_tasks');
  const canMove = hasPermission(user, 'can_move_calendar_reservations');
  const canResize = hasPermission(user, 'can_resize_calendar_reservations');
  const canCreateTasks = hasPermission(user, 'can_create_calendar_tasks');
  const canCreateBlocks = hasPermission(user, 'can_create_calendar_blocks');
  const canAssign = hasPermission(user, 'can_assign_calendar_staff');
  const canOverride = hasPermission(user, 'can_override_calendar_conflicts');

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
