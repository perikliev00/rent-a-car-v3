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
  // Evaluate the condition and enter the branch when it is true.
  if (!value) return '—';
  // Start a try block for operations that may fail.
  try {
    // Create the d constant.
    const d = new Date(value);
    // Create the date part constant.
    const datePart = d.toLocaleDateString();
    // Return the resulting value to the caller.
    return time ? `${datePart} ${time}` : datePart;
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return value;
  }
}

/**
 * Localized date+time for history timestamps.
 * @param value - ISO datetime
 */
export function formatTimestamp(value?: string | null) {
  // Evaluate the condition and enter the branch when it is true.
  if (!value) return '—';
  // Start a try block for operations that may fail.
  try {
    // Return the resulting value to the caller.
    return new Date(value).toLocaleString();
  // Contribute this line to the enclosing declaration or statement.
  } catch {
    // Return the resulting value to the caller.
    return value;
  }
}

/**
 * Heuristic status chip colors from status substring keywords.
 * @param status - Raw status string
 */
export function statusChipClass(status: string) {
  // Create the s constant.
  const s = status.toLowerCase();
  // Evaluate the condition and enter the branch when it is true.
  if (s.includes('active') || s.includes('confirm') || s.includes('return') || s.includes('pickup')) {
    // Return the resulting value to the caller.
    return 'bg-[var(--color-success)]/10 text-[var(--color-success)]';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (s.includes('paid') || s.includes('pending') || s.includes('hold') || s.includes('review')) {
    // Return the resulting value to the caller.
    return 'bg-[var(--color-accent-muted)] text-[var(--color-ink)]';
  }
  // Evaluate the condition and enter the branch when it is true.
  if (s.includes('cancel') || s.includes('fail') || s.includes('expir') || s.includes('overdue')) {
    // Return the resulting value to the caller.
    return 'bg-[var(--color-danger)]/10 text-[var(--color-danger)]';
  }
  // Return the resulting value to the caller.
  return 'bg-[var(--color-surface)] text-[var(--color-muted)]';
}

/**
 * Human label for who changed a status history entry.
 * @param entry - Status history row
 */
export function formatChangedBy(entry: ReservationStatusHistoryEntry) {
  // Evaluate the condition and enter the branch when it is true.
  if (entry.changedBySystem) return 'System';
  // Evaluate the condition and enter the branch when it is true.
  if (entry.changedByEmail) return entry.changedByEmail;
  // Evaluate the condition and enter the branch when it is true.
  if (entry.changedByUserId != null) return `User #${entry.changedByUserId}`;
  // Return the resulting value to the caller.
  return '—';
}
