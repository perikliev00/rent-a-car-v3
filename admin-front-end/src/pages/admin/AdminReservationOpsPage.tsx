import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getReservationOpsDashboard } from '../../api/admin/reservations';
import { Button } from '../../components/ui/Button';
import { Card, CardBody } from '../../components/ui/Card';
import { PageLoader } from '../../components/ui/Loading';
import { CancellationRequestsPanel } from './reservationOps/CancellationRequestsPanel';
import { ChecklistPanel } from './reservationOps/ChecklistPanel';
import { OpsTable } from './reservationOps/OpsTable';
import { StatusHistoryPanel } from './reservationOps/StatusHistoryPanel';
import { emptyWidgets, WIDGET_META } from './reservationOps/opsWidgets';

export function AdminReservationOpsPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'reservations', 'ops-dashboard'],
    queryFn: () => getReservationOpsDashboard(20),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin', 'reservations', 'ops-dashboard'] });
    if (selectedId) {
      queryClient.invalidateQueries({
        queryKey: ['admin', 'reservations', selectedId, 'detail'],
      });
    }
  };

  function setSelectedId(id: string | null) {
    const next = new URLSearchParams(searchParams);
    if (id) next.set('id', id);
    else next.delete('id');
    setSearchParams(next, { replace: true });
  }

  const toggleSelect = (id: string) => {
    setSelectedId(selectedId === id ? null : id);
  };

  if (isLoading) return <PageLoader />;

  if (isError) {
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

  const widgets = data?.widgets ?? emptyWidgets();

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
