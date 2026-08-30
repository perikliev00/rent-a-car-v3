import type { ReservationStatusHistoryEntry } from '../../../api/admin/reservations';

export function formatWhen(value?: string | null, time?: string | null) {
  if (!value) return '—';
  try {
    const d = new Date(value);
    const datePart = d.toLocaleDateString();
    return time ? `${datePart} ${time}` : datePart;
  } catch {
    return value;
  }
}

export function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

export function statusChipClass(status: string) {
  const s = status.toLowerCase();
  if (s.includes('active') || s.includes('confirm') || s.includes('return') || s.includes('pickup')) {
    return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  }
  if (s.includes('paid') || s.includes('pending') || s.includes('hold') || s.includes('review')) {
    return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  }
  if (s.includes('cancel') || s.includes('fail') || s.includes('expir') || s.includes('overdue')) {
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

export function formatChangedBy(entry: ReservationStatusHistoryEntry) {
  if (entry.changedBySystem) return 'System';
  if (entry.changedByEmail) return entry.changedByEmail;
  if (entry.changedByUserId != null) return `User #${entry.changedByUserId}`;
  return '—';
}
