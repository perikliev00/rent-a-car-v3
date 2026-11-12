/**
 * Card UI for a single staff task in role task boards.
 */
import { Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useMutation, useQueryClient } from '@tanstack/react-query';
// Import named exports from '../../../api/admin/calendar'.
import { updateCalendarTaskStatus } from '../../../api/admin/calendar';
// Import named exports from '../../../components/ui/Button'.
import { Button } from '../../../components/ui/Button';
// Import named exports from '../../../components/ui/toastStore'.
import { toast } from '../../../components/ui/toastStore';
// Import named exports from '../../../auth/permissions'.
import { hasPermission } from '../../../auth/permissions';
// Import named exports from '../../../auth/useAuth'.
import { useAuth } from '../../../auth/useAuth';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  TASK_STATUS_LABELS,
  // Contribute this line to the enclosing declaration or statement.
  TASK_TYPE_LABELS,
  // Contribute this line to the enclosing declaration or statement.
  allowedNextStatuses,
  // Declare the StaffTask TypeScript type alias.
  type StaffTask,
  // Declare the TaskStatus TypeScript type alias.
  type TaskStatus,
  // Declare the TaskType TypeScript type alias.
  type TaskType,
// Contribute this line to the enclosing declaration or statement.
} from './taskDomain';

/** Fmt. */
function fmt(iso: string | null | undefined) {
  // Evaluate the condition and enter the branch when it is true.
  if (!iso) return '—';
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return new Date(iso).toLocaleString();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return String(iso);
  }
}

// Continue the surrounding logic with this statement.
const ACTION_LABELS: Partial<Record<TaskStatus, string>> = {
  // Provide the in progress field value.
  in_progress: 'Start',
  // Provide the completed field value.
  completed: 'Complete',
  // Provide the failed field value.
  failed: 'Fail',
  // Provide the cancelled field value.
  cancelled: 'Cancel',
  // Provide the pending field value.
  pending: 'Reopen',
  // Provide the assigned field value.
  assigned: 'Reopen assigned',
};

/** Card UI for a single staff task in role task boards. */
export function TaskCard({
  // Contribute this line to the enclosing declaration or statement.
  task,
  // Update showDocsLink with the right-hand side value.
  showDocsLink = false,
  // Contribute this line to the enclosing declaration or statement.
  onEdit,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the task field value.
  task: StaffTask;
  // Contribute this line to the enclosing declaration or statement.
  showDocsLink?: boolean;
  // Continue the surrounding logic with this statement.
  onEdit?: (task: StaffTask) => void;
// Continue the surrounding logic with this statement.
}) {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Create the is manager constant.
  const isManager = hasPermission(user, 'can_create_calendar_tasks');
  // Create the can view docs constant.
  const canViewDocs = hasPermission(user, 'can_view_calendar_customer_documents');
  // Create the status constant.
  const status = task.status as TaskStatus;
  // Create the next constant.
  const next = allowedNextStatuses(status, { isManager }).filter(
    // Continue the surrounding logic with this statement.
    (s) => s !== 'pending' || isManager
  );

  // Create the status mutation constant.
  const statusMutation = useMutation({
    // Provide the mutation fn field value.
    mutationFn: (nextStatus: string) => updateCalendarTaskStatus(task.id, nextStatus),
    // Provide the on success field value.
    onSuccess: () => {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      // Call toast to perform this step.
      toast('Task updated', 'success');
    },
    // Provide the on error field value.
    onError: (err) => toast((err as Error).message, 'error'),
  });

  // Create the primary actions constant.
  const primaryActions = next.filter((s) =>
    // Continue the surrounding logic with this statement.
    ['in_progress', 'completed', 'failed'].includes(s)
  );
  // Create the secondary actions constant.
  const secondaryActions = next.filter((s) => !primaryActions.includes(s));

  // Return control to the caller with the following value.
  return (
    <div
      data-task-id={task.id}
      data-testid={`task-card-${task.id}`}
      className="min-w-0 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-soft)]"
    >
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-display break-words text-lg font-semibold text-[var(--color-ink)]">{task.title}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {TASK_TYPE_LABELS[task.taskType as TaskType] || task.taskType}
            {' · '}
            {TASK_STATUS_LABELS[status] || task.status}
          </p>
        </div>
        {onEdit ? (
          <Button size="sm" variant="outline" className="shrink-0" onClick={() => onEdit(task)}>
            Edit
          </Button>
        ) : null}
      </div>

      <dl className="mt-3 grid min-w-0 grid-cols-1 gap-1 text-sm text-[var(--color-ink)] sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-[var(--color-muted)]">Car</dt>
          <dd className="break-words">{task.carName || task.carId || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--color-muted)]">Due</dt>
          <dd>{fmt(task.dueAt || task.startsAt)}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--color-muted)]">Location</dt>
          <dd className="break-words">{task.locationText || '—'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-[var(--color-muted)]">Reservation</dt>
          <dd className="break-words">{task.reservationId || '—'}</dd>
        </div>
      </dl>

      {task.notes ? (
        <p className="mt-2 break-words text-sm text-[var(--color-muted)]">{task.notes}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {primaryActions.map((s) => (
          <Button
            key={s}
            size="sm"
            loading={statusMutation.isPending}
            onClick={() => statusMutation.mutate(s)}
          >
            {ACTION_LABELS[s] || TASK_STATUS_LABELS[s]}
          </Button>
        ))}
        {secondaryActions.map((s) => (
          <Button
            key={s}
            size="sm"
            variant="outline"
            loading={statusMutation.isPending}
            onClick={() => statusMutation.mutate(s)}
          >
            {ACTION_LABELS[s] || TASK_STATUS_LABELS[s]}
          </Button>
        ))}
        {showDocsLink && canViewDocs && task.reservationId ? (
          <Link
            to={`/admin/reservations?id=${task.reservationId}`}
            className="inline-flex items-center rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-ink)] hover:bg-[var(--color-surface)]"
          >
            Documents / ops
          </Link>
        ) : null}
      </div>
    </div>
  );
}
