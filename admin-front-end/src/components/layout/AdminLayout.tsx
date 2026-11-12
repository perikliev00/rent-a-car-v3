/**
 * Admin chrome: RBAC-gated nav, fleet-alert badge, SSE live indicator, mobile drawer.
 *
 * Nav visibility is permission-driven (not role slug alone). Task links are
 * inserted after Calendar when present so ops staff find them next to scheduling.
 */
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../auth/useAuth';
import { hasAnyPermission, hasPermission } from '../../auth/permissions';
import { getFleetAlerts } from '../../api/admin/cars';
import { useAdminRealtime } from '../../hooks/useAdminRealtime';
import { Button } from '../ui/Button';
import { Drawer } from '../ui/Drawer';

type NavItem = {
  to: string;
  label: string;
  end?: boolean;
  /** Visible to any authenticated staff user. */
  staffOnly?: boolean;
  permission?: string;
  anyOf?: string[];
};

/** Static nav catalog; filtered per-user before render. */
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
    anyOf: ['can_manage_payments_monitor', 'can_view_revenue', 'can_refund_payments'],
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

/**
 * Prefer the role-specific task board when the user holds that staff role.
 * @param roles - Session role slugs
 */
function myTasksPath(roles: string[] | undefined): string {
  if (roles?.includes('driver')) return '/admin/tasks/driver';
  if (roles?.includes('cleaner')) return '/admin/tasks/cleaner';
  if (roles?.includes('receptionist')) return '/admin/tasks/receptionist';
  return '/admin/tasks/driver';
}

/**
 * Compact SSE connection badge (hidden while idle).
 * @param state - Connection state from {@link useAdminRealtime}
 */
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

/**
 * Renders filtered nav links for sidebar or mobile drawer variants.
 * Shows a capped alert badge on the Fleet alerts item when `alertCount` > 0.
 *
 * @param items - Visible nav items after RBAC filtering
 * @param alertCount - Unresolved fleet-alert count for the badge
 * @param onNavigate - Optional click handler (e.g. close mobile drawer)
 * @param variant - Visual style for sidebar vs drawer
 */
function NavItems({
  items,
  alertCount,
  onNavigate,
  variant,
}: {
  items: NavItem[];
  alertCount: number;
  onNavigate?: () => void;
  variant: 'sidebar' | 'drawer';
}) {
  return (
    <>
      {items.map((item) => (
        <NavLink
          key={`${item.to}-${item.label}`}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            variant === 'sidebar'
              ? `flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-white/10 text-white shadow-[inset_3px_0_0_0_var(--color-accent)]'
                    : 'text-slate-400 hover:bg-white/5 hover:text-white'
                }`
              : `flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-sm font-medium ${
                  isActive
                    ? 'bg-[var(--color-ink)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-ink)] hover:bg-[var(--color-surface)]/80'
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
    </>
  );
}

/** Admin chrome: RBAC-gated nav, fleet-alert badge, SSE live indicator, mobile drawer. Nav visibility is permission-driven (not role slug alone). Task links are inserted after Calendar when present so ops staff find them next to scheduling. */
export function AdminLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  // SSE lives here so all admin pages share one connection + live indicator.
  const realtimeState = useAdminRealtime();
  const canSeeFleetAlerts = hasPermission(user, 'can_manage_fleet_alerts');
  const { data: fleetAlerts } = useQuery({
    queryKey: ['admin', 'fleet-alerts'],
    queryFn: getFleetAlerts,
    staleTime: 60_000,
    enabled: canSeeFleetAlerts,
  });
  const alertCount = fleetAlerts?.summary.total ?? 0;

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Manager task board and/or role-specific “My tasks” links.
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

  // RBAC filter of the static nav catalog.
  const visibleNav = [
    ...adminNav.filter((item) => {
      if (item.staffOnly) return true;
      if (item.anyOf) return hasAnyPermission(user, item.anyOf);
      if (item.permission) return hasPermission(user, item.permission);
      return true;
    }),
  ];

  // Keep task boards adjacent to Calendar in the sidebar order.
  const calendarIdx = visibleNav.findIndex((i) => i.to === '/admin/calendar');
  if (calendarIdx >= 0) {
    visibleNav.splice(calendarIdx + 1, 0, ...taskNav);
  } else {
    visibleNav.splice(1, 0, ...taskNav);
  }

  // Optional link back to the public booking site (strip trailing slashes).
  const customerUrl = import.meta.env.VITE_CUSTOMER_FRONTEND_URL
    ? import.meta.env.VITE_CUSTOMER_FRONTEND_URL.replace(/\/+$/, '')
    : '';

  return (
    <div className="flex min-h-screen bg-[var(--color-surface)]">
      <aside className="hidden w-64 flex-shrink-0 bg-asphalt text-slate-300 lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-6 py-5">
          <Link to="/admin" className="font-display text-lg font-bold text-white">
            Lux<span className="text-[var(--color-accent)]">Ride</span>
            <span className="ml-2 text-xs font-sans font-normal tracking-wide text-slate-400">
              Admin
            </span>
            <LiveIndicator state={realtimeState} />
          </Link>
        </div>
        <nav className="flex-1 space-y-1 overflow-y-auto p-4">
          <NavItems items={visibleNav} alertCount={alertCount} variant="sidebar" />
        </nav>
        <div className="border-t border-white/10 p-4">
          {customerUrl ? (
            <a
              href={customerUrl}
              className="block min-h-11 py-2 text-sm text-slate-400 transition-colors hover:text-white"
            >
              ← Back to site
            </a>
          ) : null}
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

      <div className="flex min-w-0 w-full flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--color-line)] bg-[var(--color-surface-elevated)] px-4 py-3 lg:hidden">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 font-display text-sm font-bold text-[var(--color-ink)]">
              Lux<span className="text-[var(--color-accent-ink)]">Ride</span> Admin
              <LiveIndicator state={realtimeState} />
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11 shrink-0 px-3"
              aria-expanded={menuOpen}
              aria-controls="admin-mobile-nav"
              onClick={() => setMenuOpen(true)}
              data-testid="admin-mobile-menu"
            >
              Menu
              {alertCount > 0 ? (
                <span className="rounded-md bg-[var(--color-danger)]/90 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                  {alertCount > 99 ? '99+' : alertCount}
                </span>
              ) : null}
            </Button>
          </div>
        </header>

        <Drawer
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title="Admin menu"
          side="left"
        >
          <nav id="admin-mobile-nav" className="space-y-1" aria-label="Admin">
            <NavItems
              items={visibleNav}
              alertCount={alertCount}
              variant="drawer"
              onNavigate={() => setMenuOpen(false)}
            />
          </nav>
          <div className="mt-6 space-y-2 border-t border-[var(--color-line)] pt-4">
            {customerUrl ? (
              <a
                href={customerUrl}
                className="flex min-h-11 items-center text-sm text-[var(--color-muted)] hover:text-[var(--color-ink)]"
              >
                ← Back to site
              </a>
            ) : null}
            <Button
              variant="outline"
              className="w-full min-h-11"
              onClick={() => {
                setMenuOpen(false);
                void logout();
              }}
              data-testid="admin-mobile-logout"
            >
              Log out
            </Button>
          </div>
        </Drawer>

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full min-w-0 max-w-full">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
