import { Button } from '../../../../components/ui/Button';
import {
  TASK_STATUS_LABELS,
  allowedNextStatuses,
  type TaskStatus,
} from '../../tasks/taskDomain';
import { Field, Section } from './EventDetailsPrimitives';
import { fmt } from './formatEventDate';

export function TaskEventDetails({
  task,
  canTasks,
  busy,
  onEditTask,
  setTaskStatus,
  removeTask,
}: {
  task: Record<string, unknown>;
  canTasks: boolean;
  busy: boolean;
  onEditTask?: (task: Record<string, unknown>) => void;
  setTaskStatus: (next: string) => void | Promise<void>;
  removeTask: () => void | Promise<void>;
}) {
  return (
    <div className="space-y-4 text-sm">
      <Section title="Task">
        <Field label="Title" value={String(task.title)} />
        <Field label="Type" value={String(task.taskType)} />
        <Field label="Status" value={String(task.status)} />
        <Field label="Due" value={task.dueAt ? fmt(String(task.dueAt)) : '—'} />
        <Field label="Location" value={String(task.locationText || '—')} />
      </Section>
      <div className="flex flex-wrap gap-2 border-t border-[var(--color-line)] pt-4">
        {allowedNextStatuses(String(task.status) as TaskStatus, { isManager: canTasks })
          .filter((s) => ['in_progress', 'completed', 'failed', 'cancelled', 'pending', 'assigned'].includes(s))
          .map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === 'failed' || s === 'cancelled' ? 'outline' : 'primary'}
              disabled={busy}
              onClick={() => void setTaskStatus(s)}
            >
              {s === 'in_progress'
                ? 'Start'
                : s === 'completed'
                  ? 'Complete'
                  : s === 'failed'
                    ? 'Fail'
                    : TASK_STATUS_LABELS[s]}
            </Button>
          ))}
        {canTasks && onEditTask ? (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onEditTask(task)}>
            Edit
          </Button>
        ) : null}
        {canTasks ? (
          <Button size="sm" variant="danger" disabled={busy} onClick={() => void removeTask()}>
            Delete
          </Button>
        ) : null}
      </div>
    </div>
  );
}
