/**
 * Compact badge for refund operation status in tables.
 */
import type { OpsReservationRow } from '../../../api/admin/reservations';
// Import named exports from './refundFormat'.
import { refundLedgerChipClass, refundLedgerLabel, truncateFailure } from './refundFormat';

/**
 * Renders pending/failed refund chips; optionally shows an explicit “none” chip.
 *
 * @param row - Ops row with optional refundOperation
 * @param showNone - When true, render a muted “none” chip if no refund op
 * @param className - Extra classes appended to the chip
 */
export function RefundLedgerBadge({
  // Contribute this line to the enclosing declaration or statement.
  row,
  // Update showNone with the right-hand side value.
  showNone = false,
  // Update className with the right-hand side value.
  className = '',
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the row field value.
  row: Pick<OpsReservationRow, 'refundOperation'>;
  // Contribute this line to the enclosing declaration or statement.
  showNone?: boolean;
  // Contribute this line to the enclosing declaration or statement.
  className?: string;
// Continue the surrounding logic with this statement.
}) {
  // Create the label constant.
  const label = refundLedgerLabel(row);
  // Create the extra constant.
  const extra = className ? ` ${className}` : '';
  // No refund operation — hide unless the table wants an explicit none marker.
  if (label === 'none') {
    // Evaluate the condition and enter the branch when it is true.
    if (!showNone) return null;
    // Return control to the caller with the following value.
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${refundLedgerChipClass('none')}${extra}`}>
        none
      </span>
    );
  }
  // Evaluate the condition and enter the branch when it is true.
  if (label === 'pending') {
    // Return control to the caller with the following value.
    return (
      <span className={`inline-block rounded px-1.5 py-0.5 font-medium ${refundLedgerChipClass('pending')}${extra}`}>
        Refund pending
      </span>
    );
  }
  // Evaluate the condition and enter the branch when it is true.
  if (label === 'failed') {
    // Create the detail constant.
    const detail = truncateFailure(row.refundOperation?.failureMessage);
    // Return control to the caller with the following value.
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
