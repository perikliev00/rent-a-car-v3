/**
 * Create/edit staff calendar tasks with assignee/car fields.
 */
import { useEffect, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from 'date-fns'.
import { formatISO, parseISO } from 'date-fns';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  createCalendarTask,
  // Contribute this line to the enclosing declaration or statement.
  getAssignableStaff,
  // Contribute this line to the enclosing declaration or statement.
  updateCalendarTask,
// Contribute this line to the enclosing declaration or statement.
} from '../../../api/admin/calendar';
// Import named exports from '../../../components/ui/Modal'.
import { Modal } from '../../../components/ui/Modal';
// Import named exports from '../../../components/ui/Input'.
import { Input } from '../../../components/ui/Input';
// Import named exports from '../../../components/ui/Select'.
import { Select } from '../../../components/ui/Select';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/DateSelect'.
import { DateSelect } from '../../../components/ui/DateSelect';
// Import named exports from '../../../components/ui/TimeSelect'.
import { TimeSelect } from '../../../components/ui/TimeSelect';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Contribute this line to the enclosing declaration or statement.
import type { CalendarCar } from './calendar.types';
// Import named exports from '../tasks/taskDomain'.
import { taskTypeOptions } from '../tasks/taskDomain';

/** Split Iso. */
function splitIso(iso: string | undefined | null): { date: string; time: string } {
  // Evaluate the condition and enter the branch when it is true.
  if (!iso) {
    // Create the now constant.
    const now = new Date();
    // Return the resulting value to the caller.
    return {
      // Provide the date field value.
      date: formatISO(now, { representation: 'date' }),
      // Provide the time field value.
      time: `${String(now.getHours()).padStart(2, '0')}:00`,
    };
  }
  // Create the d constant.
  const d = parseISO(iso);
  // Return the resulting value to the caller.
  return {
    // Provide the date field value.
    date: formatISO(d, { representation: 'date' }),
    // Provide the time field value.
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

/** Join Iso. */
function joinIso(date: string, time: string): string {
  // Return the resulting value to the caller.
  return new Date(`${date}T${time}:00`).toISOString();
}

/** Create/edit staff calendar tasks with assignee/car fields. */
export function TaskFormModal({
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  onClose,
  // Contribute this line to the enclosing declaration or statement.
  cars,
  // Update mode with the right-hand side value.
  mode = 'create',
  // Contribute this line to the enclosing declaration or statement.
  taskId,
  // Contribute this line to the enclosing declaration or statement.
  defaults,
  // Update canAssign with the right-hand side value.
  canAssign = false,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the open field value.
  open: boolean;
  // Provide the on close field value.
  onClose: () => void;
  // Provide the cars field value.
  cars: CalendarCar[];
  // Contribute this line to the enclosing declaration or statement.
  mode?: 'create' | 'edit';
  // Contribute this line to the enclosing declaration or statement.
  taskId?: string | null;
  // Contribute this line to the enclosing declaration or statement.
  defaults?: {
    // Contribute this line to the enclosing declaration or statement.
    title?: string;
    // Contribute this line to the enclosing declaration or statement.
    taskType?: string;
    // Contribute this line to the enclosing declaration or statement.
    carId?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    startsAt?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    dueAt?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    locationText?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    notes?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    assignedToUserId?: string | null;
    // Contribute this line to the enclosing declaration or statement.
    reservationId?: string | null;
  };
  // Contribute this line to the enclosing declaration or statement.
  canAssign?: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Create the start constant.
  const start = splitIso(defaults?.startsAt || defaults?.dueAt);
  // Create the due constant.
  const due = splitIso(defaults?.dueAt || defaults?.startsAt);

  // Destructure array values into local variables.
  const [title, setTitle] = useState(defaults?.title || '');
  // Destructure array values into local variables.
  const [taskType, setTaskType] = useState(defaults?.taskType || 'pickup');
  // Destructure array values into local variables.
  const [carId, setCarId] = useState(defaults?.carId || '');
  // Destructure array values into local variables.
  const [startDate, setStartDate] = useState(start.date);
  // Destructure array values into local variables.
  const [startTime, setStartTime] = useState(start.time);
  // Destructure array values into local variables.
  const [dueDate, setDueDate] = useState(due.date);
  // Destructure array values into local variables.
  const [dueTime, setDueTime] = useState(due.time);
  // Destructure array values into local variables.
  const [locationText, setLocationText] = useState(defaults?.locationText || '');
  // Destructure array values into local variables.
  const [notes, setNotes] = useState(defaults?.notes || '');
  // Destructure array values into local variables.
  const [assignedToUserId, setAssignedToUserId] = useState(defaults?.assignedToUserId || '');
  // Destructure array values into local variables.
  const [reservationId, setReservationId] = useState(defaults?.reservationId || '');

  // Create the staff query constant.
  const staffQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'calendar', 'assignable-staff'],
    // Provide the query fn field value.
    queryFn: getAssignableStaff,
    // Provide the enabled field value.
    enabled: open && canAssign,
    // Provide the stale time field value.
    staleTime: 60_000,
  });

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;
    // Create the s constant.
    const s = splitIso(defaults?.startsAt || defaults?.dueAt);
    // Create the d constant.
    const d = splitIso(defaults?.dueAt || defaults?.startsAt);
    // Call setTitle to perform this step.
    setTitle(defaults?.title || '');
    // Call setTaskType to perform this step.
    setTaskType(defaults?.taskType || 'pickup');
    // Call setCarId to perform this step.
    setCarId(defaults?.carId || '');
    // Call setStartDate to perform this step.
    setStartDate(s.date);
    // Call setStartTime to perform this step.
    setStartTime(s.time);
    // Call setDueDate to perform this step.
    setDueDate(d.date);
    // Call setDueTime to perform this step.
    setDueTime(d.time);
    // Call setLocationText to perform this step.
    setLocationText(defaults?.locationText || '');
    // Call setNotes to perform this step.
    setNotes(defaults?.notes || '');
    // Call setAssignedToUserId to perform this step.
    setAssignedToUserId(defaults?.assignedToUserId || '');
    // Call setReservationId to perform this step.
    setReservationId(defaults?.reservationId || '');
  // Continue the surrounding logic with this statement.
  }, [open, defaults]);

  // Create the mutation constant.
  const mutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: async () => {
      // Continue the surrounding logic with this statement.
      const body: Record<string, unknown> = {
        // Contribute this line to the enclosing declaration or statement.
        title,
        // Contribute this line to the enclosing declaration or statement.
        taskType,
        // Provide the car id field value.
        carId: carId ? Number(carId) : null,
        // Provide the starts at field value.
        startsAt: joinIso(startDate, startTime),
        // Provide the due at field value.
        dueAt: joinIso(dueDate, dueTime),
        // Provide the reservation id field value.
        reservationId: reservationId ? Number(reservationId) : null,
      };
      // Evaluate the condition and enter the branch when it is true.
      if (locationText.trim()) body.locationText = locationText.trim();
      // Evaluate the condition and enter the branch when it is true.
      if (notes.trim()) body.notes = notes.trim();
      // Evaluate the condition and enter the branch when it is true.
      if (canAssign) {
        // Update body.assignedToUserId with the right-hand side value.
        body.assignedToUserId = assignedToUserId ? Number(assignedToUserId) : null;
      }
      // Evaluate the condition and enter the branch when it is true.
      if (mode === 'edit' && taskId) {
        // Wait until the asynchronous operation resolves.
        await updateCalendarTask(taskId, body);
        // Return control to the caller with the following value.
        return;
      }
      // Wait until the asynchronous operation resolves.
      await createCalendarTask(body);
    },
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      // Call toast to perform this step.
      toast(mode === 'edit' ? 'Task updated' : 'Task created', 'success');
      // Call onClose to perform this step.
      onClose();
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the staff options constant.
  const staffOptions = [
    // Contribute this line to the enclosing declaration or statement.
    { value: '', label: 'Unassigned' },
    // Call ... to perform this step.
    ...(staffQuery.data?.users || []).map((u) => ({
      // Provide the value field value.
      value: u.id,
      // Provide the label field value.
      label: `${u.email} (${u.roles.map((r) => r.slug).join(', ') || u.role})`,
    })),
  ];

  // Return control to the caller with the following value.
  return (
    <Modal open={open} onClose={onClose} title={mode === 'edit' ? 'Edit task' : 'Create task'}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Select
          label="Type"
          value={taskType}
          onChange={(e) => setTaskType(e.target.value)}
          options={taskTypeOptions()}
          required
        />
        <Select
          label="Car"
          value={carId}
          onChange={(e) => setCarId(e.target.value)}
          options={[{ value: '', label: 'No car' }, ...cars.map((c) => ({ value: c.id, label: c.name }))]}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <DateSelect label="Starts date" value={startDate} onChange={setStartDate} />
          <TimeSelect label="Starts time" value={startTime} onChange={setStartTime} />
          <DateSelect label="Due date" value={dueDate} onChange={setDueDate} />
          <TimeSelect label="Due time" value={dueTime} onChange={setDueTime} />
        </div>
        <Input
          label="Location"
          value={locationText}
          onChange={(e) => setLocationText(e.target.value)}
        />
        <Input label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Input
          label="Reservation ID"
          value={reservationId}
          onChange={(e) => setReservationId(e.target.value)}
          placeholder="Optional"
        />
        {canAssign ? (
          <Select
            label="Assignee"
            value={assignedToUserId}
            onChange={(e) => setAssignedToUserId(e.target.value)}
            options={staffOptions}
          />
        ) : null}
        <Button type="submit" loading={mutation.isPending}>
          {mode === 'edit' ? 'Save' : 'Create'}
        </Button>
      </form>
    </Modal>
  );
}
