import type { OpsReservationRow } from '../../../api/admin/reservations';

export function formatRefundMoney(row: Pick<OpsReservationRow, 'totalPrice' | 'refundOperation'>): string | null {
  const cents = row.refundOperation?.amountCents;
  if (Number.isFinite(cents) && Number(cents) > 0) {
    const currency = String(row.refundOperation?.currency || 'EUR').toUpperCase();
    return `${(Number(cents) / 100).toFixed(2)} ${currency}`;
  }
  const price = Number(row.totalPrice);
  if (Number.isFinite(price) && price > 0) {
    return `${price.toFixed(2)} EUR`;
  }
  return null;
}

export function truncateFailure(message?: string | null) {
  const text = String(message || '').trim();
  if (!text) return '';
  return text.length > 48 ? `${text.slice(0, 45)}…` : text;
}

export function refundLedgerChipClass(kind: 'pending' | 'fail' | 'ok' | 'none') {
  if (kind === 'pending') return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  if (kind === 'fail') return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  if (kind === 'ok') return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

export function refundLedgerLabel(row: Pick<OpsReservationRow, 'refundOperation'>): 'none' | 'pending' | 'failed' | 'succeeded' {
  const status = row.refundOperation?.status;
  if (status === 'pending' || status === 'failed' || status === 'succeeded') return status;
  return 'none';
}
