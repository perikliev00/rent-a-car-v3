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

export function useCalendarSchedule() {
  const queryClient = useQueryClient();
  const [conflicts, setConflicts] = useState<CalendarConflict[]>([]);
  const [isMoving, setIsMoving] = useState(false);
  const [pendingMove, setPendingMove] = useState<Omit<SchedulePayload, 'force'> | null>(null);
  const [pendingBlockForce, setPendingBlockForce] = useState<((force: boolean) => void) | null>(
    null
  );

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

  function onBlockConflict(c: CalendarConflict[], retry: (force: boolean) => void) {
    setConflicts(c);
    setPendingBlockForce(() => retry);
  }

  function clearConflicts() {
    setConflicts([]);
    setPendingMove(null);
    setPendingBlockForce(null);
  }

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
