/**
 * Display formatters for reservation ops tables/panels.
 */
import type { ReservationStatusHistoryEntry } from '../../../api/admin/reservations';

/**
 * Format a date (and optional time string) for ops table cells.
 * @param value - ISO date/datetime
 * @param time - Optional HH:MM appended after the localized date
 */
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

/**
 * Localized date+time for history timestamps.
 * @param value - ISO datetime
 */
export function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}

/**
 * Heuristic status chip colors from status substring keywords.
 * @param status - Raw status string
 */
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

/**
 * Human label for who changed a status history entry.
 * @param entry - Status history row
 */
export function formatChangedBy(entry: ReservationStatusHistoryEntry) {
  if (entry.changedBySystem) return 'System';
  if (entry.changedByEmail) return entry.changedByEmail;
  if (entry.changedByUserId != null) return `User #${entry.changedByUserId}`;
  return '—';
}
