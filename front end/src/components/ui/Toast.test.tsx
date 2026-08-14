import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastContainer } from './Toast';
import { toast } from './toastStore';

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runAllTimers();
    });
    vi.useRealTimers();
  });

  it('displays toast messages', () => {
    render(<ToastContainer />);

    act(() => {
      toast('Saved successfully', 'success');
    });

    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });

  it('auto-dismisses toasts after 4 seconds', () => {
    render(<ToastContainer />);

    act(() => {
      toast('Temporary message', 'info');
    });

    expect(screen.getByText('Temporary message')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(screen.queryByText('Temporary message')).not.toBeInTheDocument();
  });
});
