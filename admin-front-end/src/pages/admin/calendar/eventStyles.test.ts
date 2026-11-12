import { describe, expect, it } from 'vitest';
import {
  eventBarClass,
  eventChipClass,
  eventTypeLabel,
} from './eventStyles';

describe('eventStyles', () => {
  it('returns configured styles and labels for known event types', () => {
    expect(eventBarClass('reservation')).toContain('color-ink');
    expect(eventChipClass('pickup')).toContain('color-success');
    expect(eventTypeLabel('return')).toBe('Return');
  });

  it('falls back safely for unknown event types', () => {
    expect(eventBarClass('unknown')).toBe(
      'border-l-[var(--color-muted)] bg-[var(--color-muted)] text-white',
    );

    expect(eventChipClass('unknown')).toBe(
      'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]',
    );

    expect(eventTypeLabel('custom_event')).toBe('custom_event');
  });
});
