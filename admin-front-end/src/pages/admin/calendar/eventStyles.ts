/** Semantic LuxRide token styles for calendar event types (no rainbow utility festival). */

export const EVENT_TYPE_STYLE: Record<
  // Contribute this line to the enclosing declaration or statement.
  string,
  // Contribute this line to the enclosing declaration or statement.
  { bar: string; chip: string; label: string }
// Continue the surrounding logic with this statement.
> = {
  // Provide the reservation field value.
  reservation: {
    // Provide the bar field value.
    bar: 'border-l-[var(--color-ink)] bg-[var(--color-ink)]/90 text-white',
    // Provide the chip field value.
    chip: 'border-[var(--color-ink)]/30 bg-[var(--color-ink)]/10 text-[var(--color-ink)]',
    // Provide the label field value.
    label: 'Reservation',
  },
  // Provide the pickup field value.
  pickup: {
    // Provide the bar field value.
    bar: 'border-l-[var(--color-success)] bg-[var(--color-success)]/85 text-white',
    // Provide the chip field value.
    chip: 'border-[var(--color-success)]/30 bg-[var(--color-success)]/10 text-[var(--color-success)]',
    // Provide the label field value.
    label: 'Pickup',
  },
  // Return the resulting value to the caller.
  return: {
    // Provide the bar field value.
    bar: 'border-l-[var(--color-accent-hover)] bg-[var(--color-accent)] text-[var(--color-ink)]',
    // Provide the chip field value.
    chip: 'border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)] text-[var(--color-ink)]',
    // Provide the label field value.
    label: 'Return',
  },
  // Provide the blocked field value.
  blocked: {
    // Provide the bar field value.
    bar: 'border-l-[var(--color-muted)] bg-[var(--color-muted)]/80 text-white',
    // Provide the chip field value.
    chip: 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]',
    // Provide the label field value.
    label: 'Blocked',
  },
  // Provide the maintenance field value.
  maintenance: {
    // Provide the bar field value.
    bar: 'border-l-[var(--color-danger)] bg-[var(--color-danger)]/80 text-white',
    // Provide the chip field value.
    chip: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
    // Provide the label field value.
    label: 'Maintenance',
  },
  // Provide the cleaning field value.
  cleaning: {
    // Provide the bar field value.
    bar: 'border-l-[var(--color-ink-soft)] bg-[var(--color-ink-soft)]/85 text-white',
    // Provide the chip field value.
    chip: 'border-[var(--color-ink-soft)]/25 bg-[var(--color-ink-soft)]/10 text-[var(--color-ink-soft)]',
    // Provide the label field value.
    label: 'Cleaning',
  },
  // Provide the manual review field value.
  manual_review: {
    // Provide the bar field value.
    bar: 'border-l-[var(--color-danger)] bg-[var(--color-danger)]/70 text-white',
    // Provide the chip field value.
    chip: 'border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 text-[var(--color-danger)]',
    // Provide the label field value.
    label: 'Review',
  },
  // Provide the payment issue field value.
  payment_issue: {
    // Provide the bar field value.
    bar: 'border-l-[var(--color-danger)] bg-[var(--color-danger)] text-white',
    // Provide the chip field value.
    chip: 'border-[var(--color-danger)]/40 bg-[var(--color-danger)]/15 text-[var(--color-danger)]',
    // Provide the label field value.
    label: 'Payment',
  },
  // Provide the task field value.
  task: {
    // Provide the bar field value.
    bar: 'border-l-[var(--color-accent)] bg-[var(--color-ink-soft)] text-white',
    // Provide the chip field value.
    chip: 'border-[var(--color-accent)]/40 bg-[var(--color-accent-muted)] text-[var(--color-ink)]',
    // Provide the label field value.
    label: 'Task',
  },
};

// Export the legend items const.
export const LEGEND_ITEMS = [
  // Supply the literal value used by the enclosing expression.
  'reservation',
  // Supply the literal value used by the enclosing expression.
  'pickup',
  // Supply the literal value used by the enclosing expression.
  'return',
  // Supply the literal value used by the enclosing expression.
  'blocked',
  // Supply the literal value used by the enclosing expression.
  'maintenance',
  // Supply the literal value used by the enclosing expression.
  'cleaning',
  // Supply the literal value used by the enclosing expression.
  'task',
  // Supply the literal value used by the enclosing expression.
  'payment_issue',
  // Supply the literal value used by the enclosing expression.
  'manual_review',
// Apply the TypeScript type assertion for this value.
] as const;

/**
 * Timeline/month bar classes for an event type (fallback muted).
 * @param type - Calendar event type key
 */
export function eventBarClass(type: string): string {
  // Return the resulting value to the caller.
  return EVENT_TYPE_STYLE[type]?.bar || 'border-l-[var(--color-muted)] bg-[var(--color-muted)] text-white';
}

/**
 * Compact chip classes for an event type (fallback surface).
 * @param type - Calendar event type key
 */
export function eventChipClass(type: string): string {
  // Return the resulting value to the caller.
  return EVENT_TYPE_STYLE[type]?.chip || 'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]';
}

/**
 * Human label for an event type (falls back to the raw type string).
 * @param type - Calendar event type key
 */
export function eventTypeLabel(type: string): string {
  // Return the resulting value to the caller.
  return EVENT_TYPE_STYLE[type]?.label || type;
}

// Export the problem event types const.
export const PROBLEM_EVENT_TYPES = [
  // Supply the literal value used by the enclosing expression.
  'maintenance',
  // Supply the literal value used by the enclosing expression.
  'cleaning',
  // Supply the literal value used by the enclosing expression.
  'payment_issue',
  // Supply the literal value used by the enclosing expression.
  'manual_review',
// Apply the TypeScript type assertion for this value.
] as const;
