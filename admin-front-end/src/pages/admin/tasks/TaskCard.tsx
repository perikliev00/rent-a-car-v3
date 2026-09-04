import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateCalendarTaskStatus } from '../../../api/admin/calendar';
import { Button } from '../../../components/ui/Button';
import { toast } from '../../../components/ui/toastStore';
import { hasPermission } from '../../../auth/permissions';
import { useAuth } from '../../../auth/useAuth';
import {
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  allowedNextStatuses,
  type StaffTask,
  type TaskStatus,
  type TaskType,
} from './taskDomain';

function fmt(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return String(iso);
  }
}

const ACTION_LABELS: Partial<Record<TaskStatus, string>> = {
  in_progress: 'Start',
  completed: 'Complete',
  failed: 'Fail',
  cancelled: 'Cancel',
  pending: 'Reopen',
  assigned: 'Reopen assigned',
};

export function TaskCard({
  task,
  showDocsLink = false,
  onEdit,
}: {
  task: StaffTask;
  showDocsLink?: boolean;
  onEdit?: (task: StaffTask) => void;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const isManager = hasPermission(user, 'can_create_calendar_tasks');
  const canViewDocs = hasPermission(user, 'can_view_calendar_customer_documents');
  const status = task.status as TaskStatus;
  const next = allowedNextStatuses(status, { isManager }).filter(
    (s) => s !== 'pending' || isManager
  );

  const statusMutation = useMutation({
    mutationFn: (nextStatus: string) => updateCalendarTaskStatus(task.id, nextStatus),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'tasks'] });
      queryClient.invalidateQueries({ queryKey: ['admin', 'calendar'] });
      toast('Task updated', 'success');
    },
    onError: (err) => toast((err as Error).message, 'error'),
  });

  const primaryActions = next.filter((s) =>
    ['in_progress', 'completed', 'failed'].includes(s)
  );
  const secondaryActions = next.filter((s) => !primaryActions.includes(s));

  return (
    <div
      data-task-id={task.id}
      data-testid={`task-card-${task.id}`}
      className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-4 shadow-[var(--shadow-soft)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-lg font-semibold text-[var(--color-ink)]">{task.title}</p>
          <p className="mt-1 text-sm text-[var(--color-muted)]">
            {TASK_TYPE_LABELS[task.taskType as TaskType] || task.taskType}
            {' · '}
            {TASK_STATUS_LABELS[status] || task.status}
          </p>
        </div>
        {onEdit ? (
          <Button size="sm" variant="outline" onClick={() => onEdit(task)}>
            Edit
          </Button>
        ) : null}
      </div>

      <dl className="mt-3 grid gap-1 text-sm text-[var(--color-ink)] sm:grid-cols-2">
        <div>
          <dt className="text-[var(--color-muted)]">Car</dt>
          <dd>{task.carName || task.carId || '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Due</dt>
          <dd>{fmt(task.dueAt || task.startsAt)}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Location</dt>
          <dd>{task.locationText || '—'}</dd>
        </div>
        <div>
          <dt className="text-[var(--color-muted)]">Reservation</dt>
          <dd>{task.reservationId || '—'}</dd>
        </div>
      </dl>

      {task.notes ? (
        <p className="mt-2 text-sm text-[var(--color-muted)]">{task.notes}</p>
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
