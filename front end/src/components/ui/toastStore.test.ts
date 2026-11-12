// Import named exports from '@testing-library/react'.
import { act } from '@testing-library/react';
// Import named exports from 'vitest'.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from './toastStore'.
import { subscribeToasts, toast } from './toastStore';

// Declare a test suite grouping related cases.
describe('toastStore', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Call vi.useFakeTimers to perform this step.
    vi.useFakeTimers();
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Call act to perform this step.
    act(() => {
      // Call vi.runAllTimers to perform this step.
      vi.runAllTimers();
    });
    // Call vi.useRealTimers to perform this step.
    vi.useRealTimers();
  });

  // Define a single test case and its expectations.
  it('notifies subscribers when a toast is added', () => {
    // Create the listener constant.
    const listener = vi.fn();
    // Call subscribeToasts to perform this step.
    subscribeToasts(listener);

    // Call act to perform this step.
    act(() => {
      // Call toast to perform this step.
      toast('Hello', 'success');
    });

    // Assert that the value matches the intended expectation.
    expect(listener).toHaveBeenCalled();
    // Assert that the value matches the intended expectation.
    expect(listener.mock.calls.at(-1)?.[0]).toEqual(
      // Call expect.arrayContaining to perform this step.
      expect.arrayContaining([expect.objectContaining({ message: 'Hello', type: 'success' })]),
    );
  });

  // Define a single test case and its expectations.
  it('removes toast after auto-dismiss timeout', () => {
    // Create the listener constant.
    const listener = vi.fn();
    // Call subscribeToasts to perform this step.
    subscribeToasts(listener);

    // Call act to perform this step.
    act(() => {
      // Call toast to perform this step.
      toast('Goodbye', 'error');
    });

    // Call act to perform this step.
    act(() => {
      // Call vi.advanceTimersByTime to perform this step.
      vi.advanceTimersByTime(4000);
    });

    // Assert that the value matches the intended expectation.
    expect(listener.mock.calls.at(-1)?.[0]).toEqual([]);
  });
});
