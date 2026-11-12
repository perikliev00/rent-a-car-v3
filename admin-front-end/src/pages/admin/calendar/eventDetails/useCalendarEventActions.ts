/**
 * Permission-aware actions (cancel, edit, status) from event details.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQueryClient } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  cancelCalendarReservation,
  // Contribute this line to the enclosing declaration or statement.
  deleteCalendarBlock,
  // Contribute this line to the enclosing declaration or statement.
  deleteCalendarTask,
  // Contribute this line to the enclosing declaration or statement.
  updateCalendarTaskStatus,
// Contribute this line to the enclosing declaration or statement.
} from '../../../../api/admin/calendar';
// Import named exports from '../../../../api/admin/reservations'.
import { changeReservationStatus } from '../../../../api/admin/reservations';
// Import named exports from '../../../../components/ui/toastStore'.
import { toast } from '../../../../components/ui/toastStore';

/** Permission-aware actions (cancel, edit, status) from event details. */
export function useCalendarEventActions({
  // Contribute this line to the enclosing declaration or statement.
  reservation,
  // Contribute this line to the enclosing declaration or statement.
  task,
  // Contribute this line to the enclosing declaration or statement.
  eventId,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Continue the surrounding logic with this statement.
  reservation?: Record<string, unknown>;
  // Continue the surrounding logic with this statement.
  task?: Record<string, unknown>;
  // Provide the event id field value.
  eventId: string | null;
  // Provide the on close field value.
  onClose: () => void;
// Continue the surrounding logic with this statement.
}) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [busy, setBusy] = useState(false);

  /** Mark Status. */
  async function markStatus(next: 'picked_up' | 'returned') {
    // Evaluate the condition and enter the branch when it is true.
    if (!reservation?.id) return;
    // Call setBusy to perform this step.
    setBusy(true);
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await changeReservationStatus(String(reservation.id), { status: next });
      // Call toast to perform this step.
      toast(next === 'picked_up' ? 'Marked picked up' : 'Marked returned', 'success');
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      // Call onClose to perform this step.
      onClose();
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setBusy to perform this step.
      setBusy(false);
    }
  }

  /** Set Task Status. */
  async function setTaskStatus(next: string) {
    // Evaluate the condition and enter the branch when it is true.
    if (!task?.id) return;
    // Call setBusy to perform this step.
    setBusy(true);
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await updateCalendarTaskStatus(String(task.id), next);
      // Call toast to perform this step.
      toast('Task updated', 'success');
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      // Call onClose to perform this step.
      onClose();
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setBusy to perform this step.
      setBusy(false);
    }
  }

  /** Remove Task. */
  async function removeTask() {
    // Evaluate the condition and enter the branch when it is true.
    if (!task?.id) return;
    // Evaluate the condition and enter the branch when it is true.
    if (!window.confirm('Delete this task?')) return;
    // Call setBusy to perform this step.
    setBusy(true);
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await deleteCalendarTask(String(task.id));
      // Call toast to perform this step.
      toast('Task deleted', 'success');
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      // Call onClose to perform this step.
      onClose();
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setBusy to perform this step.
      setBusy(false);
    }
  }

  /** Remove Block. */
  async function removeBlock() {
    // Create the raw id constant.
    const rawId = eventId?.startsWith('blocked:') ? eventId.slice('blocked:'.length) : null;
    // Evaluate the condition and enter the branch when it is true.
    if (!rawId) return;
    // Evaluate the condition and enter the branch when it is true.
    if (!window.confirm('Delete this block?')) return;
    // Call setBusy to perform this step.
    setBusy(true);
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await deleteCalendarBlock(rawId);
      // Call toast to perform this step.
      toast('Block deleted', 'success');
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      // Call onClose to perform this step.
      onClose();
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setBusy to perform this step.
      setBusy(false);
    }
  }

  /** Cancel Reservation. */
  async function cancelReservation() {
    // Evaluate the condition and enter the branch when it is true.
    if (!reservation?.id) return;
    // Evaluate the condition and enter the branch when it is true.
    if (
      // Continue the surrounding logic with this statement.
      !window.confirm(
        // Supply the literal value used by the enclosing expression.
        'Cancel this reservation? The booking will be cancelled and the car will be freed on the calendar.',
      )
    // Continue the surrounding logic with this statement.
    ) {
      // Return control to the caller with the following value.
      return;
    }
    // Call setBusy to perform this step.
    setBusy(true);
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await cancelCalendarReservation(String(reservation.id));
      // Call toast to perform this step.
      toast('Reservation cancelled', 'success');
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'reservations'] });
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      // Call onClose to perform this step.
      onClose();
    // Continue the surrounding logic with this statement.
    } catch (err) {
      // Call toast to perform this step.
      toast((err as Error).message, 'error');
    // Contribute this line to the enclosing declaration or statement.
    } finally {
      // Call setBusy to perform this step.
      setBusy(false);
    }
  }

  /** Copy Phone. */
  async function copyPhone() {
    // Create the phone constant.
    const phone = reservation?.phoneNumber ? String(reservation.phoneNumber) : '';
    // Evaluate the condition and enter the branch when it is true.
    if (!phone) return;
    // Start a try block for operations that may fail.
    try {
      // Wait until the asynchronous operation resolves.
      await navigator.clipboard.writeText(phone);
      // Call toast to perform this step.
      toast('Phone copied', 'success');
    // Contribute this line to the enclosing declaration or statement.
    } catch {
      // Call toast to perform this step.
      toast('Could not copy phone', 'error');
    }
  }

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    busy,
    // Contribute this line to the enclosing declaration or statement.
    markStatus,
    // Contribute this line to the enclosing declaration or statement.
    setTaskStatus,
    // Contribute this line to the enclosing declaration or statement.
    removeTask,
    // Contribute this line to the enclosing declaration or statement.
    removeBlock,
    // Contribute this line to the enclosing declaration or statement.
    cancelReservation,
    // Contribute this line to the enclosing declaration or statement.
    copyPhone,
  };
}
