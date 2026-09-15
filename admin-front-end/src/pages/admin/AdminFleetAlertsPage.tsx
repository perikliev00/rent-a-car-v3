import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getFleetAlerts,
  type FleetAlert,
  type FleetAlertSeverity,
} from '../../api/admin/cars';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { Button } from '../../components/ui/Button';

function severityClass(severity: FleetAlertSeverity) {
  if (severity === 'critical') {
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  if (severity === 'warning') {
    return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  }
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

export function AdminFleetAlertsPage() {
  const [severityFilter, setSeverityFilter] = useState<FleetAlertSeverity | 'all'>('all');

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['admin', 'fleet-alerts'],
    queryFn: getFleetAlerts,
  });

  const filtered = useMemo(() => {
    const alerts = data?.alerts ?? [];
    if (severityFilter === 'all') return alerts;
    return alerts.filter((a) => a.severity === severityFilter);
  }, [data?.alerts, severityFilter]);

  if (isLoading) return <PageLoader />;

  if (isError) {
    return (
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
          Fleet alerts
        </h1>
        <p className="mt-2 break-words text-[var(--color-danger)]">
          {(error as Error).message || 'Failed to load alerts'}
        </p>
      </div>
    );
  }

  const summary = data?.summary ?? { total: 0, critical: 0, warning: 0, info: 0 };

  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Fleet alerts
          </h1>
          <p className="mt-1 text-[var(--color-muted)]">
            Cars with problems, expired documents, or overdue service
          </p>
        </div>
        <Button variant="ghost" size="sm" loading={isFetching} onClick={() => refetch()}>
          Refresh
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            { key: 'all' as const, label: `All (${summary.total})` },
            { key: 'critical' as const, label: `Critical (${summary.critical})` },
            { key: 'warning' as const, label: `Warning (${summary.warning})` },
            { key: 'info' as const, label: `Info (${summary.info})` },
          ] as const
        ).map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setSeverityFilter(chip.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              severityFilter === chip.key
                ? 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]'
                : 'text-[var(--color-muted)] hover:text-[var(--color-ink)]'
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <Card className="mt-6 shadow-none">
        <CardBody className="px-5 py-4">
          {!filtered.length ? (
            <p className="py-6 text-center text-sm text-[var(--color-muted)]">No fleet issues</p>
          ) : (
            <ul className="divide-y divide-[var(--color-line)]/60">
              {filtered.map((alert: FleetAlert) => (
                <li
                  key={alert.id}
                  className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium uppercase ${severityClass(alert.severity)}`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-xs text-[var(--color-muted)]">{alert.type}</span>
                    </div>
                    <p className="mt-1 break-words text-sm text-[var(--color-ink)]">{alert.message}</p>
                    <p className="mt-0.5 text-xs text-[var(--color-muted)]">{alert.carName}</p>
                  </div>
                  <Link to={`/admin/cars/${alert.carId}`}>
                    <Button size="sm" variant="outline">
                      Open car
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
