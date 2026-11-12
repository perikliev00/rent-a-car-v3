/**
 * Schedule mutations: move, resize, create block/task, conflict force.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQueryClient } from '@tanstack/react-query';
// Import named exports from '../../../api/admin/calendar'.
import { moveCalendarEvent, resizeCalendarEvent } from '../../../api/admin/calendar';
// Import named exports from '../../../api/client'.
import { ApiError } from '../../../api/client';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarConflict } from './calendar.types';

// Declare the SchedulePayload TypeScript type alias.
type SchedulePayload = {
  // Provide the id field value.
  id: string;
  // Provide the start field value.
  start: string;
  // Provide the end field value.
  end: string;
  // Provide the car id field value.
  carId: string;
  // Contribute this line to the enclosing declaration or statement.
  force?: boolean;
  // Provide the mode field value.
  mode: 'move' | 'resize';
};

/**
 * Owns move/resize API calls and the two-step conflict override flow:
 * store the pending payload, show ConflictWarningModal, then retry with `force: true`.
 */
export function useCalendarSchedule() {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  // Destructure array values into local variables.
  const [isMoving, setIsMoving] = useState(false);
  // Destructure array values into local variables.
  const [pendingMove, setPendingMove] = useState<Omit<SchedulePayload, 'force'> | null>(null);
  /** Block-create uses a callback retry rather than replaying a move payload. */
  const [pendingBlockForce, setPendingBlockForce] = useState<((force: boolean) => void) | null>(
    // Supply the literal value used by the enclosing expression.
    null
  );

  /**
   * Execute move or resize; on `CALENDAR_CONFLICT`, stash the payload for a force retry.
   * @param payload - Target schedule plus mode and optional force flag
   */
  async function applyScheduleChange(payload: SchedulePayload) {
    // Call setIsMoving to perform this step.
    setIsMoving(true);
    // Start a try block for operations that may fail.
    try {
      // Create the fn constant.
      const fn = payload.mode === 'resize' ? resizeCalendarEvent : moveCalendarEvent;
      // Wait until the asynchronous operation resolves.
      await fn(payload.id, {
        // Provide the start field value.
        start: payload.start,
        // Provide the end field value.
        end: payload.end,
        // Provide the car id field value.
        carId: payload.carId,
        // Provide the force field value.
        force: payload.force,
      });
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      // Call toast to perform this step.
      toast(payload.mode === 'resize' ? 'Reservation resized' : 'Event moved', 'success');
      // Call setPendingMove to perform this step.
      setPendingMove(null);
      // Call setConflicts to perform this step.
      setConflicts([]);
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Surface conflicts for modal confirmation instead of a generic error toast.
      if (err instanceof ApiError && err.code === 'CALENDAR_CONFLICT') {
        // Call setPendingMove to perform this step.
        setPendingMove(payload);
        // Call setConflicts to perform this step.
        setConflicts((err.conflicts as CalendarConflict[]) || []);
        // Return control to the caller with the following value.
        return;
      }
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setIsMoving to perform this step.
      setIsMoving(false);
    }
  }

  /**
   * Hook for block-create flows: store conflicts + a retry callback that accepts `force`.
   * @param c - Conflicts from the create response
   * @param retry - Caller-supplied retry with force flag
   */
  function onBlockConflict(c: CalendarConflict[], retry: (force: boolean) => void) {
    // Call setConflicts to perform this step.
    setConflicts(c);
    // Call setPendingBlockForce to perform this step.
    setPendingBlockForce(() => retry);
  }

  /** Dismiss the conflict modal and drop any pending move/block retry. */
  function clearConflicts() {
    // Call setConflicts to perform this step.
    setConflicts([]);
    // Call setPendingMove to perform this step.
    setPendingMove(null);
    // Call setPendingBlockForce to perform this step.
    setPendingBlockForce(null);
  }

  /** Confirmed by ConflictWarningModal when the user has override permission. */
  function forceOverride() {
    // Evaluate the condition and enter the branch when it is true.
    if (pendingBlockForce) {
      // Call pendingBlockForce to perform this step.
      pendingBlockForce(true);
      // Call setPendingBlockForce to perform this step.
      setPendingBlockForce(null);
      // Call setConflicts to perform this step.
      setConflicts([]);
      // Return control to the caller with the following value.
      return;
    }
    // Evaluate the condition and enter the branch when it is true.
    if (!pendingMove) return;
    // Continue the surrounding logic with this statement.
    void applyScheduleChange({ ...pendingMove, force: true });
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    conflicts,
    // Contribute this line to the enclosing declaration or statement.
    isMoving,
    // Contribute this line to the enclosing declaration or statement.
    applyScheduleChange,
    // Contribute this line to the enclosing declaration or statement.
    onBlockConflict,
    // Contribute this line to the enclosing declaration or statement.
    clearConflicts,
    // Contribute this line to the enclosing declaration or statement.
    forceOverride,
  };
}
