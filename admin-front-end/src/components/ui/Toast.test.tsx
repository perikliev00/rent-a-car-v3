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
});
