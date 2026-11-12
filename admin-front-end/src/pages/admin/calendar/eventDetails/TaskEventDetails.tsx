/**
 * Detail panel UI for staff task calendar events.
 */
import { Button } from '../../../../components/ui/Button';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  TASK_STATUS_LABELS,
  // Contribute this line to the enclosing declaration or statement.
  allowedNextStatuses,
  // Declare the TaskStatus TypeScript type alias.
  type TaskStatus,
// Contribute this line to the enclosing declaration or statement.
} from '../../tasks/taskDomain';
// Import named exports from './EventDetailsPrimitives'.
import { Field, Section } from './EventDetailsPrimitives';
// Import named exports from './formatEventDate'.
import { fmt } from './formatEventDate';

/** Detail panel UI for staff task calendar events. */
export function TaskEventDetails({
  // Contribute this line to the enclosing declaration or statement.
  task,
  // Contribute this line to the enclosing declaration or statement.
  canTasks,
  // Contribute this line to the enclosing declaration or statement.
  busy,
  // Contribute this line to the enclosing declaration or statement.
  onEditTask,
  // Contribute this line to the enclosing declaration or statement.
  setTaskStatus,
  // Contribute this line to the enclosing declaration or statement.
  removeTask,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the task field value.
  task: Record<string, unknown>;
  // Provide the can tasks field value.
  canTasks: boolean;
  // Provide the busy field value.
  busy: boolean;
  // Continue the surrounding logic with this statement.
  onEditTask?: (task: Record<string, unknown>) => void;
  // Provide the set task status field value.
  setTaskStatus: (next: string) => void | Promise<void>;
  // Provide the remove task field value.
  removeTask: () => void | Promise<void>;
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
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
