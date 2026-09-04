import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeToasts, toast } from './toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runAllTimers();
    });
    vi.useRealTimers();
  });

  it('notifies subscribers when a toast is added', () => {
    const listener = vi.fn();
    subscribeToasts(listener);

    act(() => {
      toast('Hello', 'success');
    });

    expect(listener).toHaveBeenCalled();
    expect(listener.mock.calls.at(-1)?.[0]).toEqual(
      expect.arrayContaining([expect.objectContaining({ message: 'Hello', type: 'success' })]),
    );
  });

  it('removes toast after auto-dismiss timeout', () => {
    const listener = vi.fn();
    subscribeToasts(listener);

    act(() => {
      toast('Goodbye', 'error');
    });

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(listener.mock.calls.at(-1)?.[0]).toEqual([]);
  });
});
