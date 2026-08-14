import { NavLink, Outlet, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import { hasAnyPermission, hasPermission } from '../../auth/permissions';
import { getFleetAlerts } from '../../api/admin/cars';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';
import { Button } from '../ui/Button';

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  staffOnly?: boolean;
  permission?: string;
  anyOf?: string[];
};

const adminNav: NavItem[] = [
  { to: '/admin', label: 'Dashboard', end: true, staffOnly: true },
  {
    to: '/admin/reservations',
    label: 'Ops',
    permission: 'can_view_reservations_ops',
  },
  {
    to: '/admin/calendar',
    label: 'Calendar',
    anyOf: ['can_view_calendar', 'can_view_own_calendar_tasks'],
  },
  { to: '/admin/cars', label: 'Cars', permission: 'can_manage_cars' },
  { to: '/admin/pricing', label: 'Pricing', permission: 'can_manage_pricing' },
  {
    to: '/admin/fleet-alerts',
    label: 'Fleet alerts',
    permission: 'can_manage_fleet_alerts',
  },
  { to: '/admin/orders', label: 'Orders', permission: 'can_view_orders' },
  { to: '/admin/contacts', label: 'Contacts', permission: 'can_manage_contacts' },
  {
    to: '/admin/payments',
    label: 'Payments',
    anyOf: ['can_manage_payments_monitor', 'can_view_revenue'],
  },
  {
    to: '/admin/analytics',
    label: 'Analytics',
    anyOf: ['can_view_revenue', 'can_export_reports'],
  },
  {
    to: '/admin/notifications',
    label: 'Notifications',
    permission: 'can_manage_notifications',
  },
  { to: '/admin/audit-logs', label: 'Audit logs', permission: 'can_view_audit_logs' },
  { to: '/admin/users', label: 'Users', permission: 'can_manage_users' },
  { to: '/admin/roles', label: 'Roles', permission: 'can_manage_users' },
];

function myTasksPath(roles: string[] | undefined): string {
  if (roles?.includes('driver')) return '/admin/tasks/driver';
  if (roles?.includes('cleaner')) return '/admin/tasks/cleaner';
  if (roles?.includes('receptionist')) return '/admin/tasks/receptionist';
  return '/admin/tasks/driver';
}

function LiveIndicator({ state }: { state: ReturnType<typeof useAdminRealtime> }) {
  if (state === 'idle') return null;
  const label = state === 'live' ? 'Live' : state === 'connecting' ? 'Connecting' : 'Offline';
  const dotClass =
    state === 'live'
      ? 'bg-[var(--color-success)]'
      : state === 'connecting'
        ? 'bg-[var(--color-accent)]'
        : 'bg-[var(--color-danger)]';

  return (
    <span
      className="ml-2 inline-flex items-center gap-1.5 align-middle text-[10px] font-sans font-medium uppercase tracking-wider text-slate-400"
      title={`Realtime updates: ${label}`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden />
      {label}
    </span>
  );
}

export function AdminLayout() {
  const { user, logout } = useAuth();
  const realtimeState = useAdminRealtime();
  const canSeeFleetAlerts = hasPermission(user, 'can_manage_fleet_alerts');
  const { data: fleetAlerts } = useQuery({
    queryKey: ['admin', 'fleet-alerts'],
    queryFn: getFleetAlerts,
    staleTime: 60_000,
    enabled: canSeeFleetAlerts,
  });
  const alertCount = fleetAlerts?.summary.total ?? 0;

  const taskNav: NavItem[] = [];
  if (
    hasPermission(user, 'can_create_calendar_tasks') ||
    hasPermission(user, 'can_assign_calendar_staff')
  ) {
    taskNav.push({ to: '/admin/tasks', label: 'Tasks' });
  }
  if (
    hasPermission(user, 'can_view_own_calendar_tasks') ||
    (user?.roles || []).some((r) => ['driver', 'cleaner', 'receptionist'].includes(r))
  ) {
    taskNav.push({ to: myTasksPath(user?.roles), label: 'My tasks' });
  }

  const visibleNav = [...adminNav.filter((item) => {
    if (item.staffOnly) return true;
    if (item.anyOf) return hasAnyPermission(user, item.anyOf);
    if (item.permission) return hasPermission(user, item.permission);
    return true;
  })];

  // Insert task links after Calendar
  const calendarIdx = visibleNav.findIndex((i) => i.to === '/admin/calendar');
  if (calendarIdx >= 0) {
    visibleNav.splice(calendarIdx + 1, 0, ...taskNav);
  } else {
    visibleNav.splice(1, 0, ...taskNav);
  }

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)]">
      <aside className="hidden w-64 flex-shrink-0 bg-asphalt text-slate-300 lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-6 py-5">
          <Link to="/" className="font-display text-lg font-bold text-white">
            Lux<span className="text-[var(--color-accent)]">Ride</span>
            <span className="ml-2 text-xs font-sans font-normal tracking-wide text-slate-400">
              Admin
            </span>
            <LiveIndicator state={realtimeState} />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 p-4">
          {visibleNav.map((item) => (
            <NavLink
              key={`${item.to}-${item.label}`}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white shadow-[inset_3px_0_0_0_var(--color-accent)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span>{item.label}</span>
              {item.to === '/admin/fleet-alerts' && alertCount > 0 ? (
                <span className="rounded-md bg-[var(--color-danger)]/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              ) : null}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-4">
          <Link to="/" className="block text-sm text-slate-400 transition-colors hover:text-white">
            ← Back to site
          </Link>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start text-slate-400 hover:bg-white/5 hover:text-white"
            onClick={() => logout()}
          >
            Log out
          </Button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="border-b border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-4 py-3 lg:hidden">
          <div className="mb-2 font-display text-sm font-bold text-[var(--color-ink)]">
            Lux<span className="text-[var(--color-accent-ink)]">Ride</span> Admin
            <LiveIndicator state={realtimeState} />
          </div>
          <div className="flex flex-wrap gap-2">
            {visibleNav.map((item) => (
              <NavLink
                key={`${item.to}-${item.label}`}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-1 text-xs font-medium ${
                    isActive
                      ? 'bg-[var(--color-ink)] text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-muted)]'
                  }`
                }
              >
                {item.label}
                {item.to === '/admin/fleet-alerts' && alertCount > 0
                  ? ` (${alertCount > 99 ? '99+' : alertCount})`
                  : ''}
              </NavLink>
            ))}
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
