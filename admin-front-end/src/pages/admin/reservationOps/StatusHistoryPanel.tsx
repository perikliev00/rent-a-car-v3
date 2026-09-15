import { useQuery } from '@tanstack/react-query';
import { getReservationDetail } from '../../../api/admin/reservations';
import { Button } from '../../../components/ui/Button';
import { Card, CardBody } from '../../../components/ui/Card';
import { formatChangedBy, formatTimestamp, statusChipClass } from './opsFormat';

export function StatusHistoryPanel({
  reservationId,
  onClose,
}: {
  reservationId: string;
  onClose: () => void;
}) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['admin', 'reservations', reservationId, 'detail'],
    queryFn: () => getReservationDetail(reservationId),
  });

  const reservation = data?.reservation;
  const history = data?.history ?? [];
  const carLabel =
    reservation &&
    typeof reservation.carId === 'object' &&
    reservation.carId !== null &&
    'name' in reservation.carId
      ? String((reservation.carId as { name?: string }).name || '')
      : reservation?.carName
        ? String(reservation.carName)
        : '';

  return (
    <Card className="shadow-none">
      <CardBody className="px-5 py-4">
        <div className="mb-3 flex min-w-0 flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-display font-semibold text-[var(--color-ink)]">Status History</h2>
            <p className="break-words text-sm text-[var(--color-muted)]">
              Reservation #{reservationId}
              {carLabel ? ` · ${carLabel}` : ''}
              {reservation?.status ? ` · ${String(reservation.status)}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-[var(--color-muted)]">Loading history…</p>
        ) : isError ? (
          <p className="break-words text-sm text-[var(--color-danger)]">
            {(error as Error).message || 'Failed to load history'}
          </p>
        ) : !history.length ? (
          <p className="text-sm text-[var(--color-muted)]">No status changes recorded</p>
        ) : (
          <div className="min-w-0 overflow-x-auto overscroll-x-contain">
            <table className="w-full min-w-[36rem] text-left text-xs">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
                  <th className="pb-2 pr-3 font-medium">When</th>
                  <th className="pb-2 pr-3 font-medium">Old status</th>
                  <th className="pb-2 pr-3 font-medium">New status</th>
                  <th className="pb-2 pr-3 font-medium">Changed by</th>
                  <th className="pb-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry) => (
                  <tr key={entry.id} className="border-b border-[var(--color-line)]/60 last:border-0">
                    <td className="py-1.5 pr-3 whitespace-nowrap text-[var(--color-muted)]">
                      {formatTimestamp(entry.createdAt)}
                    </td>
                    <td className="py-1.5 pr-3">
                      {entry.oldStatus ? (
                        <span
                          className={`inline-block rounded px-1.5 py-0.5 font-medium ${statusChipClass(entry.oldStatus)}`}
                        >
                          {entry.oldStatus}
                        </span>
                      ) : (
                        <span className="text-[var(--color-muted)]">—</span>
                      )}
                    </td>
                    <td className="py-1.5 pr-3">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 font-medium ${statusChipClass(entry.newStatus)}`}
                      >
                        {entry.newStatus}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-[var(--color-ink)]">{formatChangedBy(entry)}</td>
                    <td className="py-1.5 text-[var(--color-muted)]">{entry.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
