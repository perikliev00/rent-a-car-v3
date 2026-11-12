/**
 * Manager task board: assign, filter, and update calendar tasks.
 */
import { useMemo, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from 'date-fns'.
import { formatISO, addDays, startOfDay } from 'date-fns';
// Import named exports from '../../../api/admin/calendar'.
import { listCalendarTasks } from '../../../api/admin/calendar';
// Import named exports from '../../../api/admin/cars'.
import { getAdminCars } from '../../../api/admin/cars';
// Import named exports from '../../../auth/useAuth'.
import { useAuth } from '../../../auth/useAuth';
// Import named exports from '../../../auth/permissions'.
import { hasPermission } from '../../../auth/permissions';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/Select'.
import { Select } from '../../../components/ui/Select';
// Import named exports from '../../../components/ui/Loading'.
import { PageLoader } from '../../../components/ui/Loading';
// Import named exports from '../calendar/TaskFormModal'.
import { TaskFormModal } from '../calendar/TaskFormModal';
// Import named exports from './TaskCard'.
import { TaskCard } from './TaskCard';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  taskStatusOptions,
  // Contribute this line to the enclosing declaration or statement.
  taskTypeOptions,
  // Declare the StaffTask TypeScript type alias.
  type StaffTask,
// Contribute this line to the enclosing declaration or statement.
} from './taskDomain';
// Import named exports from 'react-router-dom'.
import { Navigate } from 'react-router-dom';

/** Manager task board: assign, filter, and update calendar tasks. */
export function ManagerTasksPage() {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Create the can manage constant.
  const canManage =
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_create_calendar_tasks') ||
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_assign_calendar_staff');
  // Create the can create constant.
  const canCreate = hasPermission(user, 'can_create_calendar_tasks');
  // Create the can assign constant.
  const canAssign = hasPermission(user, 'can_assign_calendar_staff');

  // Destructure array values into local variables.
  const [type, setType] = useState('');
  // Destructure array values into local variables.
  const [status, setStatus] = useState('');
  // Destructure array values into local variables.
  const [assignee, setAssignee] = useState('');
  // Destructure array values into local variables.
  const [unassigned, setUnassigned] = useState(false);
  // Destructure array values into local variables.
  const [carId, setCarId] = useState('');
  // Destructure array values into local variables.
  const [taskOpen, setTaskOpen] = useState(false);
  // Destructure array values into local variables.
  const [editTask, setEditTask] = useState<StaffTask | null>(null);

  // Create the range constant.
  const range = useMemo(() => {
    // Create the from constant.
    const from = startOfDay(new Date());
    // Create the to constant.
    const to = addDays(from, 14);
    // Return the resulting value to the caller.
    return { from: from.toISOString(), to: to.toISOString() };
  // Continue the surrounding logic with this statement.
  }, []);

  // Create the cars query constant.
  const carsQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cars'],
    // Provide the query fn field value.
    queryFn: getAdminCars,
    // Provide the enabled field value.
    enabled: canManage && hasPermission(user, 'can_manage_cars'),
  });

  // Create the tasks query constant.
  const tasksQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'tasks', 'manager', { type, status, assignee, unassigned, carId, ...range }],
    // Provide the query fn field value.
    queryFn: () =>
      // Call listCalendarTasks to perform this step.
      listCalendarTasks({
        // Provide the from field value.
        from: range.from,
        // Provide the to field value.
        to: range.to,
        // Provide the type field value.
        type: type || undefined,
        // Provide the status field value.
        status: status || undefined,
        // Provide the assignee field value.
        assignee: unassigned ? undefined : assignee || undefined,
        // Provide the unassigned field value.
        unassigned: unassigned || undefined,
        // Provide the car id field value.
        carId: carId || undefined,
        // Provide the include cancelled field value.
        includeCancelled: status === 'cancelled',
      }),
    // Provide the enabled field value.
    enabled: canManage,
  });

  // Evaluate the condition and enter the branch when it is true.
  if (!canManage) {
    return <Navigate to="/admin" replace />;
  }

  if (tasksQuery.isLoading) return <PageLoader />;

  // Create the cars constant.
  const cars = (carsQuery.data?.cars || []).map((c) => ({
    // Provide the id field value.
    id: String(c.id),
    // Provide the name field value.
    name: c.name,
    // Provide the transmission field value.
    transmission: c.transmission,
    // Provide the fuel type field value.
    fuelType: c.fuelType,
    // Provide the status field value.
    status: c.status || 'available',
    // Provide the current location field value.
    currentLocation: c.currentLocation || null,
    // Provide the category id field value.
    categoryId: null as string | null,
    // Provide the category name field value.
    categoryName: null as string | null,
  }));

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Task board
          </h1>
          <p className="mt-1 break-words text-[var(--color-muted)]">
            Assign and track staff tasks ({formatISO(new Date(), { representation: 'date' })} + 14 days)
          </p>
        </div>
        {canCreate ? (
          <Button
            className="shrink-0"
            onClick={() => {
              setEditTask(null);
              setTaskOpen(true);
            }}
          >
            Create task
          </Button>
        ) : null}
      </div>

      <div className="mt-6 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
