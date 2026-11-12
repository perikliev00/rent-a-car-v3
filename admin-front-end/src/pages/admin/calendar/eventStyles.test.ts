// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  eventBarClass,
  // Contribute this line to the enclosing declaration or statement.
  eventChipClass,
  // Contribute this line to the enclosing declaration or statement.
  eventTypeLabel,
// Contribute this line to the enclosing declaration or statement.
} from './eventStyles';

// Declare a test suite grouping related cases.
describe('eventStyles', () => {
  // Define a single test case and its expectations.
  it('returns configured styles and labels for known event types', () => {
    // Assert that the value matches the intended expectation.
    expect(eventBarClass('reservation')).toContain('color-ink');
    // Assert that the value matches the intended expectation.
    expect(eventChipClass('pickup')).toContain('color-success');
    // Assert that the value matches the intended expectation.
    expect(eventTypeLabel('return')).toBe('Return');
  });

  // Define a single test case and its expectations.
  it('falls back safely for unknown event types', () => {
    // Assert that the value matches the intended expectation.
    expect(eventBarClass('unknown')).toBe(
      // Continue the surrounding logic with this statement.
      'border-l-[var(--color-muted)] bg-[var(--color-muted)] text-white',
    );

    // Assert that the value matches the intended expectation.
    expect(eventChipClass('unknown')).toBe(
      // Continue the surrounding logic with this statement.
      'border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-muted)]',
    );

    // Assert that the value matches the intended expectation.
    expect(eventTypeLabel('custom_event')).toBe('custom_event');
  });
});
