import { describe, expect, it } from 'vitest';
import {
  TASK_TYPES,
  TASK_STATUSES,
  allowedNextStatuses,
  taskTypeOptions,
} from './taskDomain';

describe('taskDomain', () => {
  it('exposes eight task types and six statuses', () => {
    expect(TASK_TYPES).toHaveLength(8);
    expect(TASK_STATUSES).toHaveLength(6);
    expect(taskTypeOptions().every((o) => o.value && o.label)).toBe(true);
  });

  it('allows assignee happy-path transitions', () => {
    expect(allowedNextStatuses('assigned')).toEqual(
      expect.arrayContaining(['in_progress', 'cancelled', 'pending'])
    );
    expect(allowedNextStatuses('in_progress')).toEqual(
      expect.arrayContaining(['completed', 'failed', 'cancelled'])
    );
  });

  it('allows manager reopen from failed/cancelled only', () => {
    expect(allowedNextStatuses('failed')).toEqual([]);
    expect(allowedNextStatuses('failed', { isManager: true })).toEqual(
      expect.arrayContaining(['pending', 'assigned'])
    );
    expect(allowedNextStatuses('completed', { isManager: true })).toEqual([]);
  });
});
