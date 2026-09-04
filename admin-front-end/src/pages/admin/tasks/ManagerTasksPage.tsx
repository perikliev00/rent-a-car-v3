import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatISO, addDays, startOfDay } from 'date-fns';
import { listCalendarTasks } from '../../../api/admin/calendar';
import { getAdminCars } from '../../../api/admin/cars';
import { useAuth } from '../../../auth/useAuth';
import { hasPermission } from '../../../auth/permissions';
import { Button } from '../../../components/ui/Button';
import { Select } from '../../../components/ui/Select';
import { PageLoader } from '../../../components/ui/Loading';
import { TaskFormModal } from '../calendar/TaskFormModal';
import { TaskCard } from './TaskCard';
import {
  taskStatusOptions,
  taskTypeOptions,
  type StaffTask,
} from './taskDomain';
import { Navigate } from 'react-router-dom';

export function ManagerTasksPage() {
  const { user } = useAuth();
  const canManage =
    hasPermission(user, 'can_create_calendar_tasks') ||
    hasPermission(user, 'can_assign_calendar_staff');
  const canCreate = hasPermission(user, 'can_create_calendar_tasks');
  const canAssign = hasPermission(user, 'can_assign_calendar_staff');

  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const [unassigned, setUnassigned] = useState(false);
  const [carId, setCarId] = useState('');
  const [taskOpen, setTaskOpen] = useState(false);
  const [editTask, setEditTask] = useState<StaffTask | null>(null);

  const range = useMemo(() => {
    const from = startOfDay(new Date());
    const to = addDays(from, 14);
    return { from: from.toISOString(), to: to.toISOString() };
  }, []);

  const carsQuery = useQuery({
    queryKey: ['admin', 'cars'],
    queryFn: getAdminCars,
    enabled: canManage && hasPermission(user, 'can_manage_cars'),
  });

  const tasksQuery = useQuery({
    queryKey: ['admin', 'tasks', 'manager', { type, status, assignee, unassigned, carId, ...range }],
    queryFn: () =>
      listCalendarTasks({
        from: range.from,
        to: range.to,
        type: type || undefined,
        status: status || undefined,
        assignee: unassigned ? undefined : assignee || undefined,
        unassigned: unassigned || undefined,
        carId: carId || undefined,
        includeCancelled: status === 'cancelled',
      }),
    enabled: canManage,
  });

  if (!canManage) {
    return <Navigate to="/admin" replace />;
  }

  if (tasksQuery.isLoading) return <PageLoader />;

  const cars = (carsQuery.data?.cars || []).map((c) => ({
    id: String(c.id),
    name: c.name,
    transmission: c.transmission,
    fuelType: c.fuelType,
    status: c.status || 'available',
    currentLocation: c.currentLocation || null,
    categoryId: null as string | null,
    categoryName: null as string | null,
  }));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)]">
            Task board
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">
            Assign and track staff tasks ({formatISO(new Date(), { representation: 'date' })} + 14 days)
          </p>
        </div>
        {canCreate ? (
          <Button
            onClick={() => {
              setEditTask(null);
              setTaskOpen(true);
            }}
          >
            Create task
          </Button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Select
          label="Type"
          value={type}
          onChange={(e) => setType(e.target.value)}
          options={[{ value: '', label: 'All types' }, ...taskTypeOptions()]}
        />
        <Select
          label="Status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[{ value: '', label: 'All statuses' }, ...taskStatusOptions()]}
        />
        <Select
          label="Car"
          value={carId}
          onChange={(e) => setCarId(e.target.value)}
          options={[
            { value: '', label: 'All cars' },
            ...cars.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        <Select
          label="Assignee filter"
          value={unassigned ? 'unassigned' : assignee}
          onChange={(e) => {
            if (e.target.value === 'unassigned') {
              setUnassigned(true);
              setAssignee('');
            } else {
              setUnassigned(false);
              setAssignee(e.target.value);
            }
          }}
          options={[
            { value: '', label: 'Anyone' },
            { value: 'unassigned', label: 'Unassigned only' },
            { value: 'me', label: 'Assigned to me' },
          ]}
        />
      </div>

      <div className="mt-6 grid gap-3">
        {(tasksQuery.data?.tasks || []).length === 0 ? (
          <p className="text-[var(--color-muted)]">No tasks match these filters.</p>
        ) : (
          (tasksQuery.data?.tasks || []).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              showDocsLink
              onEdit={
                canCreate
                  ? (t) => {
                      setEditTask(t);
                      setTaskOpen(true);
                    }
                  : undefined
              }
            />
          ))
        )}
      </div>

      <TaskFormModal
        open={taskOpen}
        onClose={() => {
          setTaskOpen(false);
          setEditTask(null);
        }}
        cars={cars}
        mode={editTask ? 'edit' : 'create'}
        taskId={editTask?.id}
        canAssign={canAssign}
        defaults={
          editTask
            ? {
                title: editTask.title,
                taskType: String(editTask.taskType),
                carId: editTask.carId,
                startsAt: editTask.startsAt,
                dueAt: editTask.dueAt,
                locationText: editTask.locationText,
                notes: editTask.notes,
                assignedToUserId: editTask.assignedToUserId,
                reservationId: editTask.reservationId,
              }
            : undefined
        }
      />
    </div>
  );
}
