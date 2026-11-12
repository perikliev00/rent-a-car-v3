// Destructure object properties into local variables.
const {
  // Contribute this line to the enclosing declaration or statement.
  TASK_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  TASK_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  initialStatusForCreate,
  // Contribute this line to the enclosing declaration or statement.
  statusAfterAssigneeChange,
  // Contribute this line to the enclosing declaration or statement.
  assertTransition,
  // Contribute this line to the enclosing declaration or statement.
  allowedNextStatuses,
// Continue the surrounding logic with this statement.
} = require('../../src/modules/calendar/calendar.taskDomain');

// Declare a test suite grouping related cases.
describe('calendar.taskDomain', () => {
  // Define a single test case and its expectations.
  test('exports canonical types and statuses', () => {
    // Assert that the value matches the intended expectation.
    expect(TASK_TYPES).toEqual([
      // Supply the literal value used by the enclosing expression.
      'pickup',
      // Supply the literal value used by the enclosing expression.
      'delivery',
      // Supply the literal value used by the enclosing expression.
      'return',
      // Supply the literal value used by the enclosing expression.
      'cleaning',
      // Supply the literal value used by the enclosing expression.
      'inspection',
      // Supply the literal value used by the enclosing expression.
      'maintenance_dropoff',
      // Supply the literal value used by the enclosing expression.
      'maintenance_pickup',
      // Supply the literal value used by the enclosing expression.
      'document_check',
    ]);
    // Assert that the value matches the intended expectation.
    expect(TASK_STATUSES).toEqual([
      // Supply the literal value used by the enclosing expression.
      'pending',
      // Supply the literal value used by the enclosing expression.
      'assigned',
      // Supply the literal value used by the enclosing expression.
      'in_progress',
      // Supply the literal value used by the enclosing expression.
      'completed',
      // Supply the literal value used by the enclosing expression.
      'failed',
      // Supply the literal value used by the enclosing expression.
      'cancelled',
    ]);
  });

  // Define a single test case and its expectations.
  test('initialStatusForCreate depends on assignee', () => {
    // Assert that the value matches the intended expectation.
    expect(initialStatusForCreate(null)).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(initialStatusForCreate(undefined)).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(initialStatusForCreate(12)).toBe('assigned');
    // Assert that the value matches the intended expectation.
    expect(initialStatusForCreate('5')).toBe('assigned');
  });

  // Define a single test case and its expectations.
  test('statusAfterAssigneeChange only moves pending/assigned', () => {
    // Assert that the value matches the intended expectation.
    expect(statusAfterAssigneeChange('pending', 1)).toBe('assigned');
    // Assert that the value matches the intended expectation.
    expect(statusAfterAssigneeChange('assigned', null)).toBe('pending');
    // Assert that the value matches the intended expectation.
    expect(statusAfterAssigneeChange('in_progress', null)).toBe('in_progress');
    // Assert that the value matches the intended expectation.
    expect(statusAfterAssigneeChange('completed', 9)).toBe('completed');
  });

  // Define a single test case and its expectations.
  test('assertTransition allows happy path', () => {
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('pending', 'assigned')).not.toThrow();
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('assigned', 'in_progress')).not.toThrow();
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('in_progress', 'completed')).not.toThrow();
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('in_progress', 'failed')).not.toThrow();
  });

  // Define a single test case and its expectations.
  test('assertTransition blocks illegal moves', () => {
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('pending', 'completed')).toThrow(/Cannot transition/);
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('completed', 'pending')).toThrow(/Cannot transition/);
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('failed', 'pending')).toThrow(/Cannot transition/);
  });

  // Define a single test case and its expectations.
  test('assertTransition allows manager reopen from failed/cancelled', () => {
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('failed', 'pending', { isManager: true })).not.toThrow();
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('cancelled', 'assigned', { isManager: true })).not.toThrow();
    // Assert that the value matches the intended expectation.
    expect(() => assertTransition('completed', 'pending', { isManager: true })).toThrow();
  });

  // Define a single test case and its expectations.
  test('allowedNextStatuses includes manager reopen', () => {
    // Assert that the value matches the intended expectation.
    expect(allowedNextStatuses('in_progress')).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining(['completed', 'failed', 'cancelled'])
    );
    // Assert that the value matches the intended expectation.
    expect(allowedNextStatuses('failed', { isManager: true })).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining(['pending', 'assigned'])
    );
  });
});
