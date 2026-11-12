const {
  TASK_TYPES,
  TASK_STATUSES,
  initialStatusForCreate,
  statusAfterAssigneeChange,
  assertTransition,
  allowedNextStatuses,
} = require('../../src/modules/calendar/calendar.taskDomain');

describe('calendar.taskDomain', () => {
  test('exports canonical types and statuses', () => {
    expect(TASK_TYPES).toEqual([
      'pickup',
      'delivery',
      'return',
      'cleaning',
      'inspection',
      'maintenance_dropoff',
      'maintenance_pickup',
      'document_check',
    ]);
    expect(TASK_STATUSES).toEqual([
      'pending',
      'assigned',
      'in_progress',
      'completed',
      'failed',
      'cancelled',
    ]);
  });

  test('initialStatusForCreate depends on assignee', () => {
    expect(initialStatusForCreate(null)).toBe('pending');
    expect(initialStatusForCreate(undefined)).toBe('pending');
    expect(initialStatusForCreate(12)).toBe('assigned');
    expect(initialStatusForCreate('5')).toBe('assigned');
  });

  test('statusAfterAssigneeChange only moves pending/assigned', () => {
    expect(statusAfterAssigneeChange('pending', 1)).toBe('assigned');
    expect(statusAfterAssigneeChange('assigned', null)).toBe('pending');
    expect(statusAfterAssigneeChange('in_progress', null)).toBe('in_progress');
    expect(statusAfterAssigneeChange('completed', 9)).toBe('completed');
  });

  test('assertTransition allows happy path', () => {
    expect(() => assertTransition('pending', 'assigned')).not.toThrow();
    expect(() => assertTransition('assigned', 'in_progress')).not.toThrow();
    expect(() => assertTransition('in_progress', 'completed')).not.toThrow();
    expect(() => assertTransition('in_progress', 'failed')).not.toThrow();
  });

  test('assertTransition blocks illegal moves', () => {
    expect(() => assertTransition('pending', 'completed')).toThrow(/Cannot transition/);
    expect(() => assertTransition('completed', 'pending')).toThrow(/Cannot transition/);
    expect(() => assertTransition('failed', 'pending')).toThrow(/Cannot transition/);
  });

  test('assertTransition allows manager reopen from failed/cancelled', () => {
    expect(() => assertTransition('failed', 'pending', { isManager: true })).not.toThrow();
    expect(() => assertTransition('cancelled', 'assigned', { isManager: true })).not.toThrow();
    expect(() => assertTransition('completed', 'pending', { isManager: true })).toThrow();
  });

  test('allowedNextStatuses includes manager reopen', () => {
    expect(allowedNextStatuses('in_progress')).toEqual(
      expect.arrayContaining(['completed', 'failed', 'cancelled'])
    );
    expect(allowedNextStatuses('failed', { isManager: true })).toEqual(
      expect.arrayContaining(['pending', 'assigned'])
    );
  });
});
