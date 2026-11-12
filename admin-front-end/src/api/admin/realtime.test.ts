// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  getAdminRealtimeStreamUrl,
  // Contribute this line to the enclosing declaration or statement.
  isAdminRealtimeEventType,
  // Contribute this line to the enclosing declaration or statement.
  isHighSignalRealtimeType,
// Contribute this line to the enclosing declaration or statement.
} from './realtime';

// Declare a test suite grouping related cases.
describe('admin realtime api helpers', () => {
  // Define a single test case and its expectations.
  it('builds stream URL from API_BASE', () => {
    // Assert that the value matches the intended expectation.
    expect(getAdminRealtimeStreamUrl()).toMatch(/\/api\/v1\/admin\/realtime\/stream$/);
  });

  // Define a single test case and its expectations.
  it('recognizes known event types', () => {
    // Assert that the value matches the intended expectation.
    expect(isAdminRealtimeEventType('new_booking')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isAdminRealtimeEventType('reservation_updated')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isAdminRealtimeEventType('calendar_updated')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isAdminRealtimeEventType('unknown')).toBe(false);
  });

  // Define a single test case and its expectations.
  it('marks only high-signal types for toasts', () => {
    // Assert that the value matches the intended expectation.
    expect(isHighSignalRealtimeType('new_booking')).toBe(true);
    // Assert that the value matches the intended expectation.
    expect(isHighSignalRealtimeType('reservation_updated')).toBe(false);
    // Assert that the value matches the intended expectation.
    expect(isHighSignalRealtimeType('calendar_updated')).toBe(false);
  });
});
