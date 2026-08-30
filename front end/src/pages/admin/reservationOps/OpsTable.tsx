import type { OpsReservationRow } from '../../../api/admin/reservations';
import { RefundLedgerBadge } from '../refund/RefundLedgerBadge';
import { formatWhen, statusChipClass } from './opsFormat';
import { StatusActions } from './StatusActions';

export function OpsTable({
  rows,
  onChanged,
  selectedId,
  onSelect,
  showCancelReason = false,
  allowRefund = false,
}: {
  rows: OpsReservationRow[];
  onChanged: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
  showCancelReason?: boolean;
  allowRefund?: boolean;
}) {
  if (!rows.length) {
    return <p className="text-sm text-[var(--color-muted)]">No items</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-[var(--color-line)] text-[var(--color-muted)]">
            <th className="pb-2 pr-3 font-medium">ID</th>
            <th className="pb-2 pr-3 font-medium">Car</th>
            <th className="pb-2 pr-3 font-medium">Renter</th>
            <th className="pb-2 pr-3 font-medium">Pickup</th>
            <th className="pb-2 pr-3 font-medium">Return</th>
            <th className="pb-2 pr-3 font-medium">Status</th>
            {showCancelReason ? <th className="pb-2 pr-3 font-medium">Reason</th> : null}
            <th className="pb-2 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const selected = selectedId === row.id;
            return (
              <tr
                key={row.id}
                className={`border-b border-[var(--color-line)]/60 last:border-0 ${
                  selected ? 'bg-[var(--color-accent-muted)]/40' : ''
                }`}
              >
                <td className="py-1.5 pr-3 font-mono">
                  <button
                    type="button"
                    onClick={() => onSelect(row.id)}
                    className={`underline-offset-2 hover:underline ${
                      selected
                        ? 'font-semibold text-[var(--color-ink)]'
                        : 'text-[var(--color-muted)]'
                    }`}
                    title="View status history"
                  >
                    {row.id}
                  </button>
                </td>
                <td className="py-1.5 pr-3 text-[var(--color-ink)]">{row.carName || '—'}</td>
                <td className="py-1.5 pr-3">
                  <div className="text-[var(--color-ink)]">{row.fullName || '—'}</div>
                  <div className="text-[var(--color-muted)]">{row.email || ''}</div>
                </td>
                <td className="py-1.5 pr-3 text-[var(--color-ink)]">
                  {formatWhen(row.pickupDate, row.pickupTime)}
                </td>
                <td className="py-1.5 pr-3 text-[var(--color-ink)]">
                  {formatWhen(row.returnDate, row.returnTime)}
                </td>
                <td className="py-1.5 pr-3">
                  <span
                    className={`inline-block rounded px-1.5 py-0.5 font-medium ${statusChipClass(row.status)}`}
                  >
                    {row.status}
                  </span>
                  <RefundLedgerBadge row={row} className="ml-1" />
                </td>
                {showCancelReason ? (
                  <td className="py-1.5 pr-3 text-[var(--color-muted)]">{row.cancelReason || '—'}</td>
                ) : null}
                <td className="py-1.5">
                  <StatusActions row={row} onChanged={onChanged} allowRefund={allowRefund} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
