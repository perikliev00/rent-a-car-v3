import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getDashboard } from '../../api/admin/orders';
import { getFleetAlerts } from '../../api/admin/cars';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { Button } from '../../components/ui/Button';
import { formatPrice } from '../../utils/format';
import { getCarFromOrder } from '../../types/api';

/** Permission-masked stats arrive as null — show em dash, never fake zero. */
function formatStat(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return String(value);
}

function formatRevenueStat(value: number | string | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return formatPrice(value);
}

function statusChipClass(status: string) {
  const s = status.toLowerCase();
  if (s === 'active' || s === 'confirmed' || s === 'done' || s === 'paid') {
    return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  }
  if (s === 'pending' || s === 'hold' || s === 'new' || s === 'ready') {
    return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  }
  if (s === 'cancelled' || s === 'expired' || s === 'failed' || s === 'overdue') {
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

function severityClass(severity: string) {
  if (severity === 'critical') {
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  if (severity === 'warning') {
    return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  }
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

export function AdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'dashboard'],
    queryFn: getDashboard,
  });

  const { data: fleetAlerts } = useQuery({
    queryKey: ['admin', 'fleet-alerts'],
    queryFn: getFleetAlerts,
    staleTime: 60_000,
  });

  if (isLoading) return <PageLoader />;

  const stats = data?.stats;
  const alertSummary = fleetAlerts?.summary;
  const topAlerts = (fleetAlerts?.alerts ?? [])
    .filter((a) => a.severity === 'critical' || a.severity === 'warning')
    .slice(0, 5);

  return (
    <div>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          Dashboard
        </h1>
        <p className="mt-1 text-[var(--color-muted)]">Overview of your rental business</p>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
            Total orders
          </p>
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-[var(--color-ink)]">
            {formatStat(stats?.totalOrders)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
            Total revenue
          </p>
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-[var(--color-success)]">
            {formatRevenueStat(stats?.totalRevenue)}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)]">
          <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
            Pending orders
          </p>
          <p className="font-display mt-2 text-4xl font-bold tracking-tight text-[var(--color-accent-ink)]">
            {formatStat(stats?.pendingOrders)}
          </p>
        </div>
        <Link
          to="/admin/fleet-alerts"
          className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface-elevated)] p-5 shadow-[var(--shadow-soft)] transition-colors hover:border-[var(--color-danger)]/40"
        >
          <p className="text-xs font-medium tracking-wide text-[var(--color-muted)] uppercase">
            Fleet alerts
          </p>
          <p
            className={`font-display mt-2 text-4xl font-bold tracking-tight ${
              (alertSummary?.total ?? 0) > 0
                ? 'text-[var(--color-danger)]'
                : 'text-[var(--color-ink)]'
            }`}
          >
            {alertSummary?.total ?? 0}
          </p>
          <p className="mt-1 text-xs text-[var(--color-muted)]">
            {alertSummary?.critical ?? 0} critical · {alertSummary?.warning ?? 0} warning
          </p>
        </Link>
      </div>

      <Card className="mt-8">
        <CardBody>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display font-semibold text-[var(--color-ink)]">Fleet alerts</h2>
            <Link to="/admin/fleet-alerts">
              <Button size="sm" variant="ghost">
                View all
              </Button>
            </Link>
          </div>
          {!topAlerts.length ? (
            <p className="mt-4 text-sm text-[var(--color-muted)]">No critical or warning alerts</p>
          ) : (
            <ul className="mt-4 divide-y divide-[var(--color-line)]/60">
              {topAlerts.map((alert) => (
                <li key={alert.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase ${severityClass(alert.severity)}`}
                      >
                        {alert.severity}
                      </span>
                      <span className="truncate text-sm text-[var(--color-ink)]">{alert.message}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">{alert.carName}</p>
                  </div>
                  <Link
                    to={`/admin/cars/${alert.carId}`}
                    className="text-xs font-medium text-[var(--color-muted)] underline-offset-2 hover:underline"
                  >
                    Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="mt-8">
        <CardBody>
          <h2 className="font-display font-semibold text-[var(--color-ink)]">Recent orders</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-xs tracking-wide text-[var(--color-muted)] uppercase">
                  <th className="pb-2 pr-4 font-medium">ID</th>
                  <th className="pb-2 pr-4 font-medium">Customer</th>
                  <th className="pb-2 pr-4 font-medium">Car</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {data?.orders.slice(0, 10).map((order) => {
                  const car = getCarFromOrder(order);
                  return (
                    <tr
                      key={order.id}
                      className="border-b border-[var(--color-line)]/60 last:border-0"
                    >
                      <td className="py-2 pr-4 font-mono text-xs text-[var(--color-muted)]">
                        #{order.id}
                      </td>
                      <td className="py-2 pr-4 text-[var(--color-ink)]">{order.fullName}</td>
                      <td className="py-2 pr-4 text-[var(--color-ink)]">{car?.name ?? '—'}</td>
                      <td className="py-2 pr-4">
                        <span
                          className={`inline-block rounded px-2 py-0.5 text-xs font-medium capitalize ${statusChipClass(order.status)}`}
                        >
                          {order.status}
                        </span>
                      </td>
                      <td className="py-2 font-medium text-[var(--color-ink)]">
                        {formatPrice(order.totalPrice)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {data?.orders.length === 0 && (
              <p className="py-8 text-center text-[var(--color-muted)]">No orders yet</p>
            )}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
