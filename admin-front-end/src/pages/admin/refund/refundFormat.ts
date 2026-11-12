/**
 * Formatting helpers for refund amounts and ledger states.
 */
import type { OpsReservationRow } from '../../../api/admin/reservations';

/**
 * Prefer refund-operation cents; fall back to reservation totalPrice as EUR.
 * @param row - Ops row with optional refundOperation
 */
export function formatRefundMoney(row: Pick<OpsReservationRow, 'totalPrice' | 'refundOperation'>): string | null {
  // Create the cents constant.
  const cents = row.refundOperation?.amountCents;
  // Gateway refund amount in minor units.
  if (Number.isFinite(cents) && Number(cents) > 0) {
    // Create the currency constant.
    const currency = String(row.refundOperation?.currency || 'EUR').toUpperCase();
    // Return the resulting value to the caller.
    return `${(Number(cents) / 100).toFixed(2)} ${currency}`;
  }
  // Fallback when no refund op amount is present yet.
  const price = Number(row.totalPrice);
  // Evaluate the condition and enter the branch when it is true.
  if (Number.isFinite(price) && price > 0) {
    // Return the resulting value to the caller.
    return `${price.toFixed(2)} EUR`;
  }
  // Return the resulting value to the caller.
  return null;
}

/**
 * Truncate failure messages for compact table chips.
 * @param message - Raw failure text
 */
export function truncateFailure(message?: string | null) {
  // Create the text constant.
  const text = String(message || '').trim();
  // Evaluate the condition and enter the branch when it is true.
  if (!text) return '';
  // Return the resulting value to the caller.
  return text.length > 48 ? `${text.slice(0, 45)}…` : text;
}

/**
 * Tailwind chip classes for refund ledger visual kinds.
 * @param kind - pending | fail | ok | none
 */
export function refundLedgerChipClass(kind: 'pending' | 'fail' | 'ok' | 'none') {
  // Evaluate the condition and enter the branch when it is true.
  if (kind === 'pending') return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  // Evaluate the condition and enter the branch when it is true.
  if (kind === 'fail') return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  // Evaluate the condition and enter the branch when it is true.
  if (kind === 'ok') return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  // Return the resulting value to the caller.
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

/**
 * Normalize refundOperation.status into a UI label key.
 * @param row - Ops row with optional refundOperation
 */
export function refundLedgerLabel(row: Pick<OpsReservationRow, 'refundOperation'>): 'none' | 'pending' | 'failed' | 'succeeded' {
  // Create the status constant.
  const status = row.refundOperation?.status;
  // Evaluate the condition and enter the branch when it is true.
  if (status === 'pending' || status === 'failed' || status === 'succeeded') return status;
  // Return the resulting value to the caller.
  return 'none';
}
