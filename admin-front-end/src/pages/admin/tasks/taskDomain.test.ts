// Import named exports from 'vitest'.
import { describe, expect, it } from 'vitest';
// Import named exports from the referenced module.
import {
  // Contribute this line to the enclosing declaration or statement.
  TASK_TYPES,
  // Contribute this line to the enclosing declaration or statement.
  TASK_STATUSES,
  // Contribute this line to the enclosing declaration or statement.
  allowedNextStatuses,
  // Contribute this line to the enclosing declaration or statement.
  taskTypeOptions,
// Contribute this line to the enclosing declaration or statement.
} from './taskDomain';

// Declare a test suite grouping related cases.
describe('taskDomain', () => {
  // Define a single test case and its expectations.
  it('exposes eight task types and six statuses', () => {
    // Assert that the value matches the intended expectation.
    expect(TASK_TYPES).toHaveLength(8);
    // Assert that the value matches the intended expectation.
    expect(TASK_STATUSES).toHaveLength(6);
    // Assert that the value matches the intended expectation.
    expect(taskTypeOptions().every((o) => o.value && o.label)).toBe(true);
  });

  // Define a single test case and its expectations.
  it('allows assignee happy-path transitions', () => {
    // Assert that the value matches the intended expectation.
    expect(allowedNextStatuses('assigned')).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining(['in_progress', 'cancelled', 'pending'])
    );
    // Assert that the value matches the intended expectation.
    expect(allowedNextStatuses('in_progress')).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining(['completed', 'failed', 'cancelled'])
    );
  });

  // Define a single test case and its expectations.
  it('allows manager reopen from failed/cancelled only', () => {
    // Assert that the value matches the intended expectation.
    expect(allowedNextStatuses('failed')).toEqual([]);
    // Assert that the value matches the intended expectation.
    expect(allowedNextStatuses('failed', { isManager: true })).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining(['pending', 'assigned'])
    );
    // Assert that the value matches the intended expectation.
    expect(allowedNextStatuses('completed', { isManager: true })).toEqual([]);
  });
});
