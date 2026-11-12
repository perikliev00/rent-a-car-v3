/**
 * Admin chrome: RBAC-gated nav, fleet-alert badge, SSE live indicator, mobile drawer.
 *
 * Nav visibility is permission-driven (not role slug alone). Task links are
 * inserted after Calendar when present so ops staff find them next to scheduling.
 */
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
// Import named exports from 'react'.
import { useEffect, useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from '../../auth/useAuth'.
import { useAuth } from '../../auth/useAuth';
// Import named exports from '../../auth/permissions'.
import { hasAnyPermission, hasPermission } from '../../auth/permissions';
// Import named exports from '../../api/admin/cars'.
import { getFleetAlerts } from '../../api/admin/cars';
// Import named exports from '../../hooks/useAdminRealtime'.
import { useAdminRealtime } from '../../hooks/useAdminRealtime';
// Import named exports from '../ui/Button'.
import { Button } from '../ui/Button';
// Import named exports from '../ui/Drawer'.
import { Drawer } from '../ui/Drawer';

// Declare the NavItem TypeScript type alias.
type NavItem = {
  // Provide the to field value.
  to: string;
  // Provide the label field value.
  label: string;
  // Contribute this line to the enclosing declaration or statement.
  end?: boolean;
  /** Visible to any authenticated staff user. */
  staffOnly?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  permission?: string;
  // Contribute this line to the enclosing declaration or statement.
  anyOf?: string[];
};

/** Static nav catalog; filtered per-user before render. */
const adminNav: NavItem[] = [
  // Contribute this line to the enclosing declaration or statement.
  { to: '/admin', label: 'Dashboard', end: true, staffOnly: true },
  {
    // Provide the to field value.
    to: '/admin/reservations',
    // Provide the label field value.
    label: 'Ops',
    // Provide the permission field value.
    permission: 'can_view_reservations_ops',
  },
  {
    // Provide the to field value.
    to: '/admin/calendar',
    // Provide the label field value.
    label: 'Calendar',
    // Provide the any of field value.
    anyOf: ['can_view_calendar', 'can_view_own_calendar_tasks'],
  },
  // Contribute this line to the enclosing declaration or statement.
  { to: '/admin/cars', label: 'Cars', permission: 'can_manage_cars' },
  // Contribute this line to the enclosing declaration or statement.
  { to: '/admin/pricing', label: 'Pricing', permission: 'can_manage_pricing' },
  {
    // Provide the to field value.
    to: '/admin/fleet-alerts',
    // Provide the label field value.
    label: 'Fleet alerts',
    // Provide the permission field value.
    permission: 'can_manage_fleet_alerts',
  },
  // Contribute this line to the enclosing declaration or statement.
  { to: '/admin/orders', label: 'Orders', permission: 'can_view_orders' },
  // Contribute this line to the enclosing declaration or statement.
  { to: '/admin/contacts', label: 'Contacts', permission: 'can_manage_contacts' },
  {
    // Provide the to field value.
    to: '/admin/payments',
    // Provide the label field value.
    label: 'Payments',
    // Provide the any of field value.
    anyOf: ['can_manage_payments_monitor', 'can_view_revenue', 'can_refund_payments'],
  },
  {
    // Provide the to field value.
    to: '/admin/analytics',
    // Provide the label field value.
    label: 'Analytics',
    // Provide the any of field value.
    anyOf: ['can_view_revenue', 'can_export_reports'],
  },
  {
    // Provide the to field value.
    to: '/admin/notifications',
    // Provide the label field value.
    label: 'Notifications',
    // Provide the permission field value.
    permission: 'can_manage_notifications',
  },
  // Contribute this line to the enclosing declaration or statement.
  { to: '/admin/audit-logs', label: 'Audit logs', permission: 'can_view_audit_logs' },
  // Contribute this line to the enclosing declaration or statement.
  { to: '/admin/users', label: 'Users', permission: 'can_manage_users' },
  // Contribute this line to the enclosing declaration or statement.
  { to: '/admin/roles', label: 'Roles', permission: 'can_manage_users' },
];

/**
 * Prefer the role-specific task board when the user holds that staff role.
 * @param roles - Session role slugs
 */
function myTasksPath(roles: string[] | undefined): string {
  // Evaluate the condition and enter the branch when it is true.
  if (roles?.includes('driver')) return '/admin/tasks/driver';
  // Evaluate the condition and enter the branch when it is true.
  if (roles?.includes('cleaner')) return '/admin/tasks/cleaner';
  // Evaluate the condition and enter the branch when it is true.
  if (roles?.includes('receptionist')) return '/admin/tasks/receptionist';
  // Return the resulting value to the caller.
  return '/admin/tasks/driver';
}

/**
 * Compact SSE connection badge (hidden while idle).
 * @param state - Connection state from {@link useAdminRealtime}
 */
function LiveIndicator({ state }: { state: ReturnType<typeof useAdminRealtime> }) {
  // Evaluate the condition and enter the branch when it is true.
  if (state === 'idle') return null;
  // Create the label constant.
  const label = state === 'live' ? 'Live' : state === 'connecting' ? 'Connecting' : 'Offline';
  // Create the dot class constant.
  const dotClass =
    // Update state with the right-hand side value.
    state === 'live'
      // Continue the surrounding logic with this statement.
      ? 'bg-[var(--color-success)]'
      // Continue the surrounding logic with this statement.
      : state === 'connecting'
        // Continue the surrounding logic with this statement.
        ? 'bg-[var(--color-accent)]'
        // Continue the surrounding logic with this statement.
        : 'bg-[var(--color-danger)]';

  // Return control to the caller with the following value.
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
  // Contribute this line to the enclosing declaration or statement.
  items,
  // Contribute this line to the enclosing declaration or statement.
  alertCount,
  // Contribute this line to the enclosing declaration or statement.
  onNavigate,
  // Contribute this line to the enclosing declaration or statement.
  variant,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the items field value.
  items: NavItem[];
  // Provide the alert count field value.
  alertCount: number;
  // Continue the surrounding logic with this statement.
  onNavigate?: () => void;
  // Provide the variant field value.
  variant: 'sidebar' | 'drawer';
// Continue the surrounding logic with this statement.
}) {
  // Return control to the caller with the following value.
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
  // Destructure object properties into local variables.
  const { user, logout } = useAuth();
  // Create the location constant.
  const location = useLocation();
  // Destructure array values into local variables.
  const [menuOpen, setMenuOpen] = useState(false);
  // SSE lives here so all admin pages share one connection + live indicator.
  const realtimeState = useAdminRealtime();
  // Create the can see fleet alerts constant.
  const canSeeFleetAlerts = hasPermission(user, 'can_manage_fleet_alerts');
  // Destructure object properties into local variables.
  const { data: fleetAlerts } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'fleet-alerts'],
    // Provide the query fn field value.
    queryFn: getFleetAlerts,
    // Provide the stale time field value.
    staleTime: 60_000,
    // Provide the enabled field value.
    enabled: canSeeFleetAlerts,
  });
  // Create the alert count constant.
  const alertCount = fleetAlerts?.summary.total ?? 0;

  // Call useEffect to perform this step.
  useEffect(() => {
    // Call setMenuOpen to perform this step.
    setMenuOpen(false);
  // Continue the surrounding logic with this statement.
  }, [location.pathname]);

  // Manager task board and/or role-specific “My tasks” links.
  const taskNav: NavItem[] = [];
  // Evaluate the condition and enter the branch when it is true.
  if (
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_create_calendar_tasks') ||
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_assign_calendar_staff')
  // Continue the surrounding logic with this statement.
  ) {
    // Call taskNav.push to perform this step.
    taskNav.push({ to: '/admin/tasks', label: 'Tasks' });
  }
  // Evaluate the condition and enter the branch when it is true.
  if (
    // Call hasPermission to perform this step.
    hasPermission(user, 'can_view_own_calendar_tasks') ||
    // Continue the surrounding logic with this statement.
    (user?.roles || []).some((r) => ['driver', 'cleaner', 'receptionist'].includes(r))
  // Continue the surrounding logic with this statement.
  ) {
    // Call taskNav.push to perform this step.
    taskNav.push({ to: myTasksPath(user?.roles), label: 'My tasks' });
  }

  // RBAC filter of the static nav catalog.
  const visibleNav = [
    // Call ...adminNav.filter to perform this step.
    ...adminNav.filter((item) => {
      // Evaluate the condition and enter the branch when it is true.
      if (item.staffOnly) return true;
      // Evaluate the condition and enter the branch when it is true.
      if (item.anyOf) return hasAnyPermission(user, item.anyOf);
      // Evaluate the condition and enter the branch when it is true.
      if (item.permission) return hasPermission(user, item.permission);
      // Return the resulting value to the caller.
      return true;
    }),
  ];

  // Keep task boards adjacent to Calendar in the sidebar order.
  const calendarIdx = visibleNav.findIndex((i) => i.to === '/admin/calendar');
  // Evaluate the condition and enter the branch when it is true.
  if (calendarIdx >= 0) {
    // Call visibleNav.splice to perform this step.
    visibleNav.splice(calendarIdx + 1, 0, ...taskNav);
  // Contribute this line to the enclosing declaration or statement.
  } else {
    // Call visibleNav.splice to perform this step.
    visibleNav.splice(1, 0, ...taskNav);
  }

  // Optional link back to the public booking site (strip trailing slashes).
  const customerUrl = import.meta.env.VITE_CUSTOMER_FRONTEND_URL
    // Continue the surrounding logic with this statement.
    ? import.meta.env.VITE_CUSTOMER_FRONTEND_URL.replace(/\/+$/, '')
    // Contribute this line to the enclosing declaration or statement.
    : '';

  // Return control to the caller with the following value.
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
