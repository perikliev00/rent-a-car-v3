/** Semantic LuxRide token styles for calendar event types (no rainbow utility festival). */

export const EVENT_TYPE_STYLE: Record<
  string,
  { bar: string; chip: string; label: string }
> = {
  reservation: {
    bar: 'border-l-[var(--color-ink)] bg-[var(--color-ink)]/90 text-white',
    chip: 'border-[var(--color-ink)]/30 bg-[var(--color-ink)]/10 text-[var(--color-ink)]',
    label: 'Reservation',
  },
  pickup: {
    bar: 'border-l-[var(--color-success)] bg-[var(--color-success)]/85 text-white',
    chip: 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]',
    label: 'Pickup',
  },
  return: {
    bar: 'border-l-[var(--color-accent-hover)] bg-[var(--color-accent)] text-[var(--color-ink)]',
    chip: 'border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)] text-[var(--color-ink)]',
    label: 'Return',
  },
  blocked: {
    bar: 'border-l-[var(--color-muted)] bg-[var(--color-muted)]/80 text-white',
    chip: 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]',
    label: 'Blocked',
  },
  maintenance: {
    bar: 'border-l-[var(--color-danger)] bg-[var(--color-danger)]/80 text-white',
    chip: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
    label: 'Maintenance',
  },
  cleaning: {
    bar: 'border-l-[var(--color-ink-soft)] bg-[var(--color-ink-soft)]/85 text-white',
    chip: 'border-[var(--color-ink-soft)]/25 bg-[var(--color-ink-soft)]/10 text-[var(--color-ink-soft)]',
    label: 'Cleaning',
  },
  manual_review: {
    bar: 'border-l-[var(--color-danger)] bg-[var(--color-danger)]/70 text-white',
    chip: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
    label: 'Review',
  },
  payment_issue: {
    bar: 'border-l-[var(--color-danger)] bg-[var(--color-danger)] text-white',
    chip: 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
    label: 'Payment',
  },
  task: {
    bar: 'border-l-[var(--color-accent)] bg-[var(--color-ink-soft)] text-white',
    chip: 'border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)] text-[var(--color-ink)]',
    label: 'Task',
  },
};

export const LEGEND_ITEMS = [
  'reservation',
  'pickup',
  'return',
  'blocked',
  'maintenance',
  'cleaning',
  'task',
  'payment_issue',
  'manual_review',
] as const;

export function eventBarClass(type: string): string {
  return EVENT_TYPE_STYLE[type]?.bar || 'border-l-[var(--color-muted)] bg-[var(--color-muted)] text-white';
}

export function eventChipClass(type: string): string {
  return EVENT_TYPE_STYLE[type]?.chip || 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]';
}

export function eventTypeLabel(type: string): string {
  return EVENT_TYPE_STYLE[type]?.label || type;
}

export const PROBLEM_EVENT_TYPES = [
  'maintenance',
  'cleaning',
  'payment_issue',
  'manual_review',
] as const;
