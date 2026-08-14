import { describe, expect, it } from 'vitest';
import {
  getAdminRealtimeStreamUrl,
  isAdminRealtimeEventType,
  isHighSignalRealtimeType,
} from './realtime';

describe('admin realtime api helpers', () => {
  it('builds stream URL from API_BASE', () => {
    expect(getAdminRealtimeStreamUrl()).toMatch(/\/api\/v1\/admin\/realtime\/stream$/);
  });

  it('recognizes known event types', () => {
    expect(isAdminRealtimeEventType('new_booking')).toBe(true);
    expect(isAdminRealtimeEventType('reservation_updated')).toBe(true);
    expect(isAdminRealtimeEventType('calendar_updated')).toBe(true);
    expect(isAdminRealtimeEventType('unknown')).toBe(false);
  });

  it('marks only high-signal types for toasts', () => {
    expect(isHighSignalRealtimeType('new_booking')).toBe(true);
    expect(isHighSignalRealtimeType('reservation_updated')).toBe(false);
    expect(isHighSignalRealtimeType('calendar_updated')).toBe(false);
  });
});
