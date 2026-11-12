/**
 * Fleet alert inbox with severity filters and reconcile action.
 */
import { useMemo, useState } from 'react';
// Import named exports from 'react-router-dom'.
import { Link } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getFleetAlerts,
  // Declare the FleetAlert TypeScript type alias.
  type FleetAlert,
  // Declare the FleetAlertSeverity TypeScript type alias.
  type FleetAlertSeverity,
// Contribute this line to the enclosing declaration or statement.
} from '../../api/admin/cars';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';

/** Severity Class. */
function severityClass(severity: FleetAlertSeverity) {
  // Evaluate the condition and enter the branch when it is true.
  if (severity === 'critical') {
    // Return the resulting value to the caller.
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (severity === 'warning') {
    // Return the resulting value to the caller.
    return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  }
  // Return the resulting value to the caller.
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

/** Fleet alert inbox with severity filters and reconcile action. */
export function AdminFleetAlertsPage() {
  // Destructure array values into local variables.
  const [severityFilter, setSeverityFilter] = useState<FleetAlertSeverity | 'all'>('all');

  // Destructure object properties into local variables.
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'fleet-alerts'],
    // Provide the query fn field value.
    queryFn: getFleetAlerts,
  });

  // Create the filtered constant.
  const filtered = useMemo(() => {
    // Create the alerts constant.
    const alerts = data?.alerts ?? [];
    // Evaluate the condition and enter the branch when it is true.
    if (severityFilter === 'all') return alerts;
    // Return the resulting value to the caller.
    return alerts.filter((a) => a.severity === severityFilter);
  // Continue the surrounding logic with this statement.
  }, [data?.alerts, severityFilter]);

  if (isLoading) return <PageLoader />;

  // Evaluate the condition and enter the branch when it is true.
  if (isError) {
    // Return control to the caller with the following value.
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

  // Create the summary constant.
  const summary = data?.summary ?? { total: 0, critical: 0, warning: 0, info: 0 };

  // Return control to the caller with the following value.
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
