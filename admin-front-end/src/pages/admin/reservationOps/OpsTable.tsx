/**
 * Shared table for ops widget reservation rows.
 */
import type { OpsReservationRow } from '../../../api/admin/reservations';
// Import named exports from '../refund/RefundLedgerBadge'.
import { RefundLedgerBadge } from '../refund/RefundLedgerBadge';
// Import named exports from './opsFormat'.
import { formatWhen, statusChipClass } from './opsFormat';
// Import named exports from './StatusActions'.
import { StatusActions } from './StatusActions';

/** Shared table for ops widget reservation rows. */
export function OpsTable({
  // Contribute this line to the enclosing declaration or statement.
  rows,
  // Contribute this line to the enclosing declaration or statement.
  onChanged,
  // Contribute this line to the enclosing declaration or statement.
  selectedId,
  // Contribute this line to the enclosing declaration or statement.
  onSelect,
  // Update showCancelReason with the right-hand side value.
  showCancelReason = false,
  // Update allowRefund with the right-hand side value.
  allowRefund = false,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the rows field value.
  rows: OpsReservationRow[];
  // Provide the on changed field value.
  onChanged: () => void;
  // Provide the selected id field value.
  selectedId: string | null;
  // Provide the on select field value.
  onSelect: (id: string) => void;
  // Contribute this line to the enclosing declaration or statement.
  showCancelReason?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  allowRefund?: boolean;
// Continue the surrounding logic with this statement.
}) {
  // Evaluate the condition and enter the branch when it is true.
  if (!rows.length) {
    return <p className="text-sm text-[var(--color-muted)]">No items</p>;
  }

  // Return control to the caller with the following value.
  return (
    <div className="min-w-0 overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[40rem] text-left text-xs">
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
                  <div className="break-words text-[var(--color-muted)]">{row.email || ''}</div>
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
