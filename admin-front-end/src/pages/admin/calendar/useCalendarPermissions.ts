/**
 * RBAC flags for calendar view/edit/assign/force actions.
 */
import type { User } from '../../../types/api';
// Import named exports from '../../../auth/permissions'.
import { hasPermission } from '../../../auth/permissions';

/**
 * Derives calendar capability flags from the current user's RBAC permissions.
 * `ownOnly` means the user may see their assigned tasks but not the full fleet grid.
 *
 * @param user - Session user (or null while loading)
 */
export function useCalendarPermissions(user: User | null | undefined) {
  // Create the can view constant.
  const canView =
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_view_calendar') ||
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_view_own_calendar_tasks');
  // Create the can move constant.
  const canMove = hasPermission(user, 'can_move_calendar_reservations');
  // Create the can resize constant.
  const canResize = hasPermission(user, 'can_resize_calendar_reservations');
  // Create the can create tasks constant.
  const canCreateTasks = hasPermission(user, 'can_create_calendar_tasks');
  // Create the can create blocks constant.
  const canCreateBlocks = hasPermission(user, 'can_create_calendar_blocks');
  // Create the can assign constant.
  const canAssign = hasPermission(user, 'can_assign_calendar_staff');
  /** Required to confirm ConflictWarningModal force overrides. */
  const canOverride = hasPermission(user, 'can_override_calendar_conflicts');

  // Staff with only own-task visibility (drivers/cleaners) skip fleet-wide filters.
  const ownOnly =
    // Continue the surrounding logic with this statement.
    !hasPermission(user, 'can_view_calendar') &&
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_view_own_calendar_tasks');

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    canView,
    // Contribute this line to the enclosing declaration or statement.
    canMove,
    // Contribute this line to the enclosing declaration or statement.
    canResize,
    // Contribute this line to the enclosing declaration or statement.
    canCreateTasks,
    // Contribute this line to the enclosing declaration or statement.
    canCreateBlocks,
    // Contribute this line to the enclosing declaration or statement.
    canAssign,
    // Contribute this line to the enclosing declaration or statement.
    canOverride,
    // Contribute this line to the enclosing declaration or statement.
    ownOnly,
  };
}
