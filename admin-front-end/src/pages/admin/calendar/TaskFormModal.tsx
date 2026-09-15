import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { formatISO, parseISO } from 'date-fns';
import {
  createCalendarTask,
  getAssignableStaff,
  updateCalendarTask,
} from '../../../api/admin/calendar';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Button } from '../../../components/ui/Button';
import { DateSelect } from '../../../components/ui/DateSelect';
import { TimeSelect } from '../../../components/ui/TimeSelect';
import { toast } from '../../../components/ui/toastStore';
import type { CalendarCar } from './calendar.types';
import { taskTypeOptions } from '../tasks/taskDomain';

function splitIso(iso: string | undefined | null): { date: string; time: string } {
  if (!iso) {
    const now = new Date();
    return {
      date: formatISO(now, { representation: 'date' }),
      time: `${String(now.getHours()).padStart(2, '0')}:00`,
    };
  }
  const d = parseISO(iso);
  return {
    date: formatISO(d, { representation: 'date' }),
    time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
  };
}

function joinIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

export function TaskFormModal({
  open,
  onClose,
  cars,
  mode = 'create',
  taskId,
  defaults,
  canAssign = false,
}: {
  open: boolean;
  onClose: () => void;
  cars: CalendarCar[];
  mode?: 'create' | 'edit';
  taskId?: string | null;
  defaults?: {
    title?: string;
    taskType?: string;
    carId?: string | null;
    startsAt?: string | null;
    dueAt?: string | null;
    locationText?: string | null;
    notes?: string | null;
    assignedToUserId?: string | null;
    reservationId?: string | null;
  };
  canAssign?: boolean;
}) {
  const queryClient = useQueryClient();
  const start = splitIso(defaults?.startsAt || defaults?.dueAt);
  const due = splitIso(defaults?.dueAt || defaults?.startsAt);

  const [title, setTitle] = useState(defaults?.title || '');
  const [taskType, setTaskType] = useState(defaults?.taskType || 'pickup');
  const [carId, setCarId] = useState(defaults?.carId || '');
  const [startDate, setStartDate] = useState(start.date);
  const [startTime, setStartTime] = useState(start.time);
  const [dueDate, setDueDate] = useState(due.date);
  const [dueTime, setDueTime] = useState(due.time);
  const [locationText, setLocationText] = useState(defaults?.locationText || '');
  const [notes, setNotes] = useState(defaults?.notes || '');
  const [assignedToUserId, setAssignedToUserId] = useState(defaults?.assignedToUserId || '');
  const [reservationId, setReservationId] = useState(defaults?.reservationId || '');

  const staffQuery = useQuery({
    queryKey: ['admin', 'calendar', 'assignable-staff'],
    queryFn: getAssignableStaff,
    enabled: open && canAssign,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) return;
    const s = splitIso(defaults?.startsAt || defaults?.dueAt);
    const d = splitIso(defaults?.dueAt || defaults?.startsAt);
    setTitle(defaults?.title || '');
    setTaskType(defaults?.taskType || 'pickup');
    setCarId(defaults?.carId || '');
    setStartDate(s.date);
    setStartTime(s.time);
    setDueDate(d.date);
    setDueTime(d.time);
    setLocationText(defaults?.locationText || '');
    setNotes(defaults?.notes || '');
    setAssignedToUserId(defaults?.assignedToUserId || '');
    setReservationId(defaults?.reservationId || '');
  }, [open, defaults]);

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        title,
        taskType,
        carId: carId ? Number(carId) : null,
        startsAt: joinIso(startDate, startTime),
        dueAt: joinIso(dueDate, dueTime),
        reservationId: reservationId ? Number(reservationId) : null,
      };
      if (locationText.trim()) body.locationText = locationText.trim();
      if (notes.trim()) body.notes = notes.trim();
      if (canAssign) {
        body.assignedToUserId = assignedToUserId ? Number(assignedToUserId) : null;
      }
      if (mode === 'edit' && taskId) {
        await updateCalendarTask(taskId, body);
        return;
      }
      await createCalendarTask(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      toast(mode === 'edit' ? 'Task updated' : 'Task created', 'success');
      onClose();
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const staffOptions = [
    { value: '', label: 'Unassigned' },
    ...(staffQuery.data?.users || []).map((u) => ({
      value: u.id,
      label: `${u.email} (${u.roles.map((r) => r.slug).join(', ') || u.role})`,
    })),
  ];

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
