import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  cancelCalendarReservation,
  deleteCalendarBlock,
  deleteCalendarTask,
  updateCalendarTaskStatus,
} from '../../../../api/admin/calendar';
import { changeReservationStatus } from '../../../../api/admin/reservations';
import { toast } from '../../../../components/ui/toastStore';

export function useCalendarEventActions({
  reservation,
  task,
  eventId,
  onClose,
}: {
  reservation?: Record<string, unknown>;
  task?: Record<string, unknown>;
  eventId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function markStatus(next: 'picked_up' | 'returned') {
    if (!reservation?.id) return;
    setBusy(true);
    try {
      await changeReservationStatus(String(reservation.id), { status: next });
      toast(next === 'picked_up' ? 'Marked picked up' : 'Marked returned', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function setTaskStatus(next: string) {
    if (!task?.id) return;
    setBusy(true);
    try {
      await updateCalendarTaskStatus(String(task.id), next);
      toast('Task updated', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeTask() {
    if (!task?.id) return;
    if (!window.confirm('Delete this task?')) return;
    setBusy(true);
    try {
      await deleteCalendarTask(String(task.id));
      toast('Task deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function removeBlock() {
    const rawId = eventId?.startsWith('blocked:') ? eventId.slice('blocked:'.length) : null;
    if (!rawId) return;
    if (!window.confirm('Delete this block?')) return;
    setBusy(true);
    try {
      await deleteCalendarBlock(rawId);
      toast('Block deleted', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function cancelReservation() {
    if (!reservation?.id) return;
    if (
      !window.confirm(
        'Cancel this reservation? The booking will be cancelled and the car will be freed on the calendar.',
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await cancelCalendarReservation(String(reservation.id));
      toast('Reservation cancelled', 'success');
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'reservations'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      onClose();
    } catch (err) {
      toast((err as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function copyPhone() {
    const phone = reservation?.phoneNumber ? String(reservation.phoneNumber) : '';
    if (!phone) return;
    try {
      await navigator.clipboard.writeText(phone);
      toast('Phone copied', 'success');
    } catch {
      toast('Could not copy phone', 'error');
    }
  }

  return {
    busy,
    markStatus,
    setTaskStatus,
    removeTask,
    removeBlock,
    cancelReservation,
    copyPhone,
  };
}
