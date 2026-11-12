/**
 * Day-of reservation ops: widgets, status actions, checklists, cancellations.
 */
import { useSearchParams } from 'react-router-dom';
// Import named exports from '@tanstack/react-query'.
import { useQuery, useQueryClient } from '@tanstack/react-query';
// Import named exports from '../../api/admin/reservations'.
import { getReservationOpsDashboard } from '../../api/admin/reservations';
// Import named exports from '../../components/ui/Button'.
import { Button } from '../../components/ui/Button';
// Import named exports from '../../components/ui/Card'.
import { Card, CardBody } from '../../components/ui/Card';
// Import named exports from '../../components/ui/Loading'.
import { PageLoader } from '../../components/ui/Loading';
// Import named exports from './reservationOps/CancellationRequestsPanel'.
import { CancellationRequestsPanel } from './reservationOps/CancellationRequestsPanel';
// Import named exports from './reservationOps/ChecklistPanel'.
import { ChecklistPanel } from './reservationOps/ChecklistPanel';
// Import named exports from './reservationOps/OpsTable'.
import { OpsTable } from './reservationOps/OpsTable';
// Import named exports from './reservationOps/StatusHistoryPanel'.
import { StatusHistoryPanel } from './reservationOps/StatusHistoryPanel';
// Import named exports from './reservationOps/opsWidgets'.
import { emptyWidgets, WIDGET_META } from './reservationOps/opsWidgets';

/** Day-of reservation ops: widgets, status actions, checklists, cancellations. */
export function AdminReservationOpsPage() {
  // Create the query client constant.
  const queryClient = useQueryClient();
  // Destructure array values into local variables.
  const [searchParams, setSearchParams] = useSearchParams();
  // Create the selected id constant.
  const selectedId = searchParams.get('id');

  // Destructure object properties into local variables.
  const { data, isLoading, isError, error } = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'reservations', 'ops-dashboard'],
    // Provide the query fn field value.
    queryFn: () => getReservationOpsDashboard(20),
  });

  // Create the refresh constant.
  const refresh = () => {
    // Call queryClient.invalidateQueries to perform this step.
    queryClient.invalidateQueries({ queryKey: ['admin', 'reservations', 'ops-dashboard'] });
    // Evaluate the condition and enter the branch when it is true.
    if (selectedId) {
      // Call queryClient.invalidateQueries to perform this step.
      queryClient.invalidateQueries({
        // Provide the query key field value.
        queryKey: ['admin', 'reservations', selectedId, 'detail'],
      });
    }
  };

  /** Set Selected Id. */
  function setSelectedId(id: string | null) {
    // Create the next constant.
    const next = new URLSearchParams(searchParams);
    // Evaluate the condition and enter the branch when it is true.
    if (id) next.set('id', id);
    // Run the fallback path after earlier conditions failed.
    else next.delete('id');
    // Call setSearchParams to perform this step.
    setSearchParams(next, { replace: true });
  }

  // Create the toggle select constant.
  const toggleSelect = (id: string) => {
    // Call setSelectedId to perform this step.
    setSelectedId(selectedId === id ? null : id);
  };

  if (isLoading) return <PageLoader />;

  // Evaluate the condition and enter the branch when it is true.
  if (isError) {
    // Return control to the caller with the following value.
    return (
      <div className="min-w-0">
        <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
          Reservation Ops
        </h1>
        <p className="mt-2 break-words text-[var(--color-danger)]">
          {(error as Error).message || 'Error loading ops dashboard'}
        </p>
      </div>
    );
  }

  // Create the widgets constant.
  const widgets = data?.widgets ?? emptyWidgets();

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--color-ink)] sm:text-3xl">
            Reservation Ops
          </h1>
          <p className="mt-1 break-words text-[var(--color-muted)]">
            Pickup, return, and payment lifecycle · Sofia day {data?.today}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={refresh}>
          Refresh
        </Button>
      </div>

      {selectedId ? (
        <div className="mt-6">
          <StatusHistoryPanel reservationId={selectedId} onClose={() => setSelectedId(null)} />
          <ChecklistPanel reservationId={selectedId} onChanged={refresh} />
        </div>
      ) : null}

      <CancellationRequestsPanel onChanged={refresh} />

      <div className="mt-8 space-y-4">
        {WIDGET_META.map((widget) => (
          <Card key={widget.key} className="shadow-none">
            <CardBody className="px-5 py-4">
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <div>
                  <h2 className="font-display font-semibold text-[var(--color-ink)]">
                    {widget.title}
                  </h2>
                  <p className="text-sm text-[var(--color-muted)]">{widget.hint}</p>
                </div>
                <p className="text-xs text-[var(--color-muted)]">
                  {widgets[widget.key].length} shown
                </p>
              </div>
              <OpsTable
                rows={widgets[widget.key]}
                onChanged={refresh}
                selectedId={selectedId}
                onSelect={toggleSelect}
                showCancelReason={widget.key === 'cancelled'}
                allowRefund={widget.key === 'todaysPickups' || widget.key === 'manualReview'}
              />
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
