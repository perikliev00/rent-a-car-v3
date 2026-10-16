/**
 * Schedule mutations: move, resize, create block/task, conflict force.
 */
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { moveCalendarEvent, resizeCalendarEvent } from '../../../api/admin/calendar';
import { ApiError } from '../../../api/client';
import { toast } from '../../../components/ui/toastStore';
import type { CalendarConflict } from './calendar.types';

type SchedulePayload = {
  id: string;
  start: string;
  end: string;
  carId: string;
  force?: boolean;
  mode: 'move' | 'resize';
};

/**
 * Owns move/resize API calls and the two-step conflict override flow:
 * store the pending payload, show ConflictWarningModal, then retry with `force: true`.
 */
export function useCalendarSchedule() {
  const queryClient = useQueryClient();
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [pendingMove, setPendingMove] = useState<Omit<SchedulePayload, 'force'> | null>(null);
  /** Block-create uses a callback retry rather than replaying a move payload. */
  const [pendingBlockForce, setPendingBlockForce] = useState<((force: boolean) => void) | null>(
    null
  );

  /**
   * Execute move or resize; on `CALENDAR_CONFLICT`, stash the payload for a force retry.
   * @param payload - Target schedule plus mode and optional force flag
   */
  async function applyScheduleChange(payload: SchedulePayload) {
    setIsMoving(true);
    try {
      const fn = payload.mode === 'resize' ? resizeCalendarEvent : moveCalendarEvent;
      await fn(payload.id, {
        start: payload.start,
        end: payload.end,
        carId: payload.carId,
        force: payload.force,
      });
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      toast(payload.mode === 'resize' ? 'Reservation resized' : 'Event moved', 'success');
      setPendingMove(null);
      setConflicts([]);
    } catch (err) {
      // Surface conflicts for modal confirmation instead of a generic error toast.
      if (err instanceof ApiError && err.code === 'CALENDAR_CONFLICT') {
        setPendingMove(payload);
        setConflicts((err.conflicts as CalendarConflict[]) || []);
        return;
      }
      toast((err as Error).message, 'error');
    } finally {
      setIsMoving(false);
    }
  }

  /**
   * Hook for block-create flows: store conflicts + a retry callback that accepts `force`.
   * @param c - Conflicts from the create response
   * @param retry - Caller-supplied retry with force flag
   */
  function onBlockConflict(c: CalendarConflict[], retry: (force: boolean) => void) {
    setConflicts(c);
    setPendingBlockForce(() => retry);
  }

  /** Dismiss the conflict modal and drop any pending move/block retry. */
  function clearConflicts() {
    setConflicts([]);
    setPendingMove(null);
    setPendingBlockForce(null);
  }

  /** Confirmed by ConflictWarningModal when the user has override permission. */
  function forceOverride() {
    if (pendingBlockForce) {
      pendingBlockForce(true);
      setPendingBlockForce(null);
      setConflicts([]);
      return;
    }
    if (!pendingMove) return;
    void applyScheduleChange({ ...pendingMove, force: true });
  }

  return {
    conflicts,
    isMoving,
    applyScheduleChange,
    onBlockConflict,
    clearConflicts,
    forceOverride,
  };
}
