/**
 * Compact badge for refund operation status in tables.
 */
import type { OpsReservationRow } from '../../../api/admin/reservations';
import { refundLedgerChipClass, refundLedgerLabel, truncateFailure } from './refundFormat';

/**
 * Renders pending/failed refund chips; optionally shows an explicit “none” chip.
 *
 * @param row - Ops row with optional refundOperation
 * @param showNone - When true, render a muted “none” chip if no refund op
 * @param className - Extra classes appended to the chip
 */
export function RefundLedgerBadge({
  row,
  showNone = false,
  className = '',
}: {
  row: Pick<OpsReservationRow, 'refundOperation'>;
  showNone?: boolean;
  className?: string;
}) {
  const label = refundLedgerLabel(row);
  const extra = className ? ` ${className}` : '';
  // No refund operation — hide unless the table wants an explicit none marker.
  if (label === 'none') {
    if (!showNone) return null;
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${refundLedgerChipClass('none')}${extra}`}>
        none
      </span>
    );
  }
  if (label === 'pending') {
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${refundLedgerChipClass('pending')}${extra}`}>
        Refund pending
      </span>
    );
  }
  if (label === 'failed') {
    const detail = truncateFailure(row.refundOperation?.failureMessage);
    return (
      <span
        className={`inline-block rounded px-1.5 py-0.5 font-medium ${refundLedgerChipClass('fail')}${extra}`}
        title={row.refundOperation?.failureMessage || undefined}
      >
        {detail ? `Refund failed: ${detail}` : 'Refund failed'}
      </span>
    );
  }
  // Succeeded (and any other) — parent tables usually show money elsewhere.
  return null;
}
