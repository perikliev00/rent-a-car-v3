/**
 * Role-scoped My Tasks pages for driver/cleaner/receptionist.
 */
import { useMemo } from 'react';
// Import named exports from 'react-router-dom'.
import { Navigate } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from 'date-fns'.
import { addDays, startOfDay } from 'date-fns';
// Import named exports from '../../../api/admin/calendar'.
import { listCalendarTasks } from '../../../api/admin/calendar';
// Import named exports from '../../../auth/useAuth'.
import { useAuth } from '../../../auth/useAuth';
// Import named exports from '../../../auth/permissions'.
import { hasPermission } from '../../../auth/permissions';
// Import named exports from '../../../components/ui/Loading'.
import { PageLoader } from '../../../components/ui/Loading';
// Import named exports from './TaskCard'.
import { TaskCard } from './TaskCard';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  CLEANER_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  DRIVER_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  RECEPTIONIST_TYPES,
  // Declare the TaskType TypeScript type alias.
  type TaskType,
// Contribute this line to the enclosing declaration or statement.
} from './taskDomain';

// Declare the RoleView TypeScript type alias.
type RoleView = 'driver' | 'cleaner' | 'receptionist';

// Continue the surrounding logic with this statement.
const CONFIG: Record<
  // Contribute this line to the enclosing declaration or statement.
  RoleView,
  // Contribute this line to the enclosing declaration or statement.
  { title: string; subtitle: string; types: TaskType[]; assigneeMe: boolean; showDocs: boolean }
// Continue the surrounding logic with this statement.
> = {
  // Provide the driver field value.
  driver: {
    // Provide the title field value.
    title: 'Driver tasks',
    // Provide the subtitle field value.
    subtitle: 'Your pickup, delivery, return, and maintenance runs',
    // Provide the types field value.
    types: DRIVER_TYPES,
    // Provide the assignee me field value.
    assigneeMe: true,
    // Provide the show docs field value.
    showDocs: false,
  },
  // Provide the cleaner field value.
  cleaner: {
    // Provide the title field value.
    title: 'Cleaner tasks',
    // Provide the subtitle field value.
    subtitle: 'Your cleaning and inspection work',
    // Provide the types field value.
    types: CLEANER_TYPES,
    // Provide the assignee me field value.
    assigneeMe: true,
    // Provide the show docs field value.
    showDocs: false,
  },
  // Provide the receptionist field value.
  receptionist: {
    // Provide the title field value.
    title: 'Reception desk',
    // Provide the subtitle field value.
    subtitle: 'Document checks and today’s operational tasks',
    // Provide the types field value.
    types: RECEPTIONIST_TYPES,
    // Provide the assignee me field value.
    assigneeMe: false,
    // Provide the show docs field value.
    showDocs: true,
  },
};

/**
 * Shared role task board: loads tasks for a role-specific type set and date window.
 * Receptionists see today only; drivers/cleaners see a 7-day window.
 *
 * @param role - Which staff role view to render
 */
function RoleTasksPage({ role }: { role: RoleView }) {
  // Destructure object properties into local variables.
  const { user } = useAuth();
  // Create the cfg constant.
  const cfg = CONFIG[role];
  // Create the can view constant.
  const canView =
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_view_own_calendar_tasks') ||
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_view_calendar') ||
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_create_calendar_tasks');

  // Reception desk focuses on today; field roles get a week lookahead.
  const range = useMemo(() => {
    // Create the from constant.
    const from = startOfDay(new Date());
    // Create the days constant.
    const days = role === 'receptionist' ? 1 : 7;
    // Create the to constant.
    const to = addDays(from, days);
    // Return the resulting value to the caller.
    return { from: from.toISOString(), to: to.toISOString() };
  // Continue the surrounding logic with this statement.
  }, [role]);

  // Create the tasks query constant.
  const tasksQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'tasks', role, range],
    // Provide the query fn field value.
    queryFn: () =>
      // Call listCalendarTasks to perform this step.
      listCalendarTasks({
        // Provide the from field value.
        from: range.from,
        // Provide the to field value.
        to: range.to,
        // Provide the types field value.
        types: cfg.types,
        // Provide the assignee field value.
        assignee: cfg.assigneeMe ? 'me' : undefined,
      }),
    // Provide the enabled field value.
    enabled: canView,
  });

  // Evaluate the condition and enter the branch when it is true.
  if (!canView) {
    return <Navigate to="/admin" replace />;
  }

  if (tasksQuery.isLoading) return <PageLoader />;

  // Create the tasks constant.
  const tasks = tasksQuery.data?.tasks || [];

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0">
      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
        {cfg.title}
      </h1>
      <p className="mt-1 text-[var(--color-muted)]">{cfg.subtitle}</p>

      <div className="mt-6 grid gap-3">
        {tasks.length === 0 ? (
          <p className="text-[var(--color-muted)]">No tasks right now.</p>
        ) : (
          tasks.map((task) => (
            <TaskCard key={task.id} task={task} showDocsLink={cfg.showDocs} />
          ))
        )}
      </div>
    </div>
  );
}

/** Role-scoped My Tasks pages for driver/cleaner/receptionist. */
export function DriverTasksPage() {
  return <RoleTasksPage role="driver" />;
}

/** Role-scoped My Tasks pages for driver/cleaner/receptionist. */
export function CleanerTasksPage() {
  return <RoleTasksPage role="cleaner" />;
}

/** Role-scoped My Tasks pages for driver/cleaner/receptionist. */
export function ReceptionistTasksPage() {
  return <RoleTasksPage role="receptionist" />;
}
