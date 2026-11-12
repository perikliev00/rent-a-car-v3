// Import named exports from '@testing-library/react'.
import { act, render, screen } from '@testing-library/react';
// Import named exports from 'vitest'.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from './Toast'.
import { ToastContainer } from './Toast';
// Import named exports from './toastStore'.
import { toast } from './toastStore';

// Declare a test suite grouping related cases.
describe('ToastContainer', () => {
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
  it('displays toast messages', () => {
    render(<ToastContainer />);

    // Call act to perform this step.
    act(() => {
      // Call toast to perform this step.
      toast('Saved successfully', 'success');
    });

    // Assert that the value matches the intended expectation.
    expect(screen.getByText('Saved successfully')).toBeInTheDocument();
  });
});
