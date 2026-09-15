import { useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { addDays, startOfDay } from 'date-fns';
import { listCalendarTasks } from '../../../api/admin/calendar';
import { useAuth } from '../../../auth/useAuth';
import { hasPermission } from '../../../auth/permissions';
import { PageLoader } from '../../../components/ui/Loading';
import { TaskCard } from './TaskCard';
import {
  CLEANER_TYPES,
  DRIVER_TYPES,
  RECEPTIONIST_TYPES,
  type TaskType,
} from './taskDomain';

type RoleView = 'driver' | 'cleaner' | 'receptionist';

const CONFIG: Record<
  RoleView,
  { title: string; subtitle: string; types: TaskType[]; assigneeMe: boolean; showDocs: boolean }
> = {
  driver: {
    title: 'Driver tasks',
    subtitle: 'Your pickup, delivery, return, and maintenance runs',
    types: DRIVER_TYPES,
    assigneeMe: true,
    showDocs: false,
  },
  cleaner: {
    title: 'Cleaner tasks',
    subtitle: 'Your cleaning and inspection work',
    types: CLEANER_TYPES,
    assigneeMe: true,
    showDocs: false,
  },
  receptionist: {
    title: 'Reception desk',
    subtitle: 'Document checks and today’s operational tasks',
    types: RECEPTIONIST_TYPES,
    assigneeMe: false,
    showDocs: true,
  },
};

function RoleTasksPage({ role }: { role: RoleView }) {
  const { user } = useAuth();
  const cfg = CONFIG[role];
  const canView =
    hasPermission(user, 'can_view_own_calendar_tasks') ||
    hasPermission(user, 'can_view_calendar') ||
    hasPermission(user, 'can_create_calendar_tasks');

  const range = useMemo(() => {
    const from = startOfDay(new Date());
    const days = role === 'receptionist' ? 1 : 7;
    const to = addDays(from, days);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [role]);

  const tasksQuery = useQuery({
    queryKey: ['admin', 'tasks', role, range],
    queryFn: () =>
      listCalendarTasks({
        from: range.from,
        to: range.to,
        types: cfg.types,
        assignee: cfg.assigneeMe ? 'me' : undefined,
      }),
    enabled: canView,
  });

  if (!canView) {
    return <Navigate to="/admin" replace />;
  }

  if (tasksQuery.isLoading) return <PageLoader />;

  const tasks = tasksQuery.data?.tasks || [];

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

export function DriverTasksPage() {
  return <RoleTasksPage role="driver" />;
}

export function CleanerTasksPage() {
  return <RoleTasksPage role="cleaner" />;
}

export function ReceptionistTasksPage() {
  return <RoleTasksPage role="receptionist" />;
}
