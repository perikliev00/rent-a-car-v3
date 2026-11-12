// Import named exports from '@testing-library/react'.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
// Import named exports from 'react'.
import { useRef, type ReactNode } from 'react';
// Import named exports from 'vitest'.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// Import named exports from './useOverlayLock'.
import { useOverlayLock } from './useOverlayLock';

// Define the async function flushAnimationFrames.
async function flushAnimationFrames() {
  // Wait until the asynchronous operation resolves.
  await act(async () => {
    // Wait until the asynchronous operation resolves.
    await new Promise<void>((resolve) => {
      // Call requestAnimationFrame to perform this step.
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

// Define the OverlayHarness function.
function OverlayHarness({
  // Contribute this line to the enclosing declaration or statement.
  open,
  // Contribute this line to the enclosing declaration or statement.
  children,
// Contribute this line to the enclosing declaration or statement.
}: {
  // Provide the open field value.
  open: boolean;
  // Contribute this line to the enclosing declaration or statement.
  children?: ReactNode;
// Continue the surrounding logic with this statement.
}) {
  // Create the ref constant.
  const ref = useRef<HTMLDivElement>(null);
  // Call useOverlayLock to perform this step.
  useOverlayLock(open, ref);
  // Return control to the caller with the following value.
  return (
    <div ref={ref} tabIndex={-1} data-testid="overlay-container">
      {children}
    </div>
  );
}

// Define the NullContainerHarness function.
function NullContainerHarness({ open }: { open: boolean }) {
  // Create the ref constant.
  const ref = useRef<HTMLDivElement>(null);
  // Call useOverlayLock to perform this step.
  useOverlayLock(open, ref);
  return <div data-testid="outside">outside</div>;
}

// Declare a test suite grouping related cases.
describe('useOverlayLock', () => {
  // Register setup that runs before the tests.
  beforeEach(() => {
    // Update document.body.style.overflow with the right-hand side value.
    document.body.style.overflow = '';
  });

  // Register cleanup that runs after the tests.
  afterEach(() => {
    // Update document.body.style.overflow with the right-hand side value.
    document.body.style.overflow = '';
  });

  // Define a single test case and its expectations.
  it('does nothing when closed', () => {
    // Update document.body.style.overflow with the right-hand side value.
    document.body.style.overflow = 'auto';
    // Call render to perform this step.
    render(
      <OverlayHarness open={false}>
        <button type="button">One</button>
      </OverlayHarness>,
    );
    // Assert that the value matches the intended expectation.
    expect(document.body.style.overflow).toBe('auto');
  });

  // Define a single test case and its expectations.
  it('locks body overflow while open and restores it on close', async () => {
    // Update document.body.style.overflow with the right-hand side value.
    document.body.style.overflow = 'scroll';
    // Destructure object properties into local variables.
    const { rerender, unmount } = render(
      <OverlayHarness open>
        <button type="button">One</button>
      </OverlayHarness>,
    );

    // Assert that the value matches the intended expectation.
    expect(document.body.style.overflow).toBe('hidden');

    // Call rerender to perform this step.
    rerender(
      <OverlayHarness open={false}>
        <button type="button">One</button>
      </OverlayHarness>,
    );
    // Wait until the asynchronous operation resolves.
    await waitFor(() => {
      // Assert that the value matches the intended expectation.
      expect(document.body.style.overflow).toBe('scroll');
    });

    // Call unmount to perform this step.
    unmount();
  });

  // Define a single test case and its expectations.
  it('supports nested scroll locks and restores only after the last unlock', () => {
    // Update document.body.style.overflow with the right-hand side value.
    document.body.style.overflow = 'visible';
    // Create the first constant.
    const first = render(
      <OverlayHarness open>
        <button type="button">First</button>
      </OverlayHarness>,
    );
    // Assert that the value matches the intended expectation.
    expect(document.body.style.overflow).toBe('hidden');

    // Create the second constant.
    const second = render(
      <OverlayHarness open>
        <button type="button">Second</button>
      </OverlayHarness>,
    );
    // Assert that the value matches the intended expectation.
    expect(document.body.style.overflow).toBe('hidden');

    // Call first.unmount to perform this step.
    first.unmount();
    // Assert that the value matches the intended expectation.
    expect(document.body.style.overflow).toBe('hidden');

    // Call second.unmount to perform this step.
    second.unmount();
    // Assert that the value matches the intended expectation.
    expect(document.body.style.overflow).toBe('visible');
  });

  // Define a single test case and its expectations.
  it('focuses the first focusable element when opened', async () => {
    // Create the trigger constant.
    const trigger = document.createElement('button');
    // Update trigger.type with the right-hand side value.
    trigger.type = 'button';
    // Update trigger.textContent with the right-hand side value.
    trigger.textContent = 'Trigger';
    // Call document.body.appendChild to perform this step.
    document.body.appendChild(trigger);
    // Call trigger.focus to perform this step.
    trigger.focus();

    // Call render to perform this step.
    render(
      <OverlayHarness open>
        <button type="button">First</button>
        <button type="button">Second</button>
      </OverlayHarness>,
    );

    // Wait until the asynchronous operation resolves.
    await flushAnimationFrames();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    // Call trigger.remove to perform this step.
    trigger.remove();
  });

  // Define a single test case and its expectations.
  it('falls back to the container when there are no focusable children', async () => {
    render(<OverlayHarness open />);
    // Wait until the asynchronous operation resolves.
    await flushAnimationFrames();
    // Assert that the value matches the intended expectation.
    expect(screen.getByTestId('overlay-container')).toHaveFocus();
  });

  // Define a single test case and its expectations.
  it('prevents Tab when the container has no focusable elements', async () => {
    render(<OverlayHarness open />);
    // Wait until the asynchronous operation resolves.
    await flushAnimationFrames();

    // Create the event constant.
    const event = new KeyboardEvent('keydown', {
      // Provide the key field value.
      key: 'Tab',
      // Provide the bubbles field value.
      bubbles: true,
      // Provide the cancelable field value.
      cancelable: true,
    });
    // Create the prevented constant.
    const prevented = vi.spyOn(event, 'preventDefault');
    // Call document.dispatchEvent to perform this step.
    document.dispatchEvent(event);
    // Assert that the value matches the intended expectation.
    expect(prevented).toHaveBeenCalled();
  });

  // Define a single test case and its expectations.
  it('wraps Tab from the last focusable to the first', async () => {
    // Call render to perform this step.
    render(
      <OverlayHarness open>
        <button type="button">First</button>
        <button type="button">Last</button>
      </OverlayHarness>,
    );
    // Wait until the asynchronous operation resolves.
    await flushAnimationFrames();

    // Call screen.getByRole to perform this step.
    screen.getByRole('button', { name: 'Last' }).focus();
    // Call fireEvent.keyDown to perform this step.
    fireEvent.keyDown(document, { key: 'Tab' });
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  // Define a single test case and its expectations.
  it('wraps Shift+Tab from the first focusable to the last', async () => {
    // Call render to perform this step.
    render(
      <OverlayHarness open>
        <button type="button">First</button>
        <button type="button">Last</button>
      </OverlayHarness>,
    );
    // Wait until the asynchronous operation resolves.
    await flushAnimationFrames();

    // Call screen.getByRole to perform this step.
    screen.getByRole('button', { name: 'First' }).focus();
    // Call fireEvent.keyDown to perform this step.
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  // Define a single test case and its expectations.
  it('restores previous focus on cleanup', async () => {
    // Create the trigger constant.
    const trigger = document.createElement('button');
    // Update trigger.type with the right-hand side value.
    trigger.type = 'button';
    // Update trigger.textContent with the right-hand side value.
    trigger.textContent = 'Trigger';
    // Call document.body.appendChild to perform this step.
    document.body.appendChild(trigger);
    // Call trigger.focus to perform this step.
    trigger.focus();

    // Destructure object properties into local variables.
    const { unmount } = render(
      <OverlayHarness open>
        <button type="button">Inside</button>
      </OverlayHarness>,
    );
    // Wait until the asynchronous operation resolves.
    await flushAnimationFrames();
    // Assert that the value matches the intended expectation.
    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();

    // Call unmount to perform this step.
    unmount();
    // Assert that the value matches the intended expectation.
    expect(trigger).toHaveFocus();
    // Call trigger.remove to perform this step.
    trigger.remove();
  });

  // Define a single test case and its expectations.
  it('ignores keyboard trapping when the container ref is not attached', async () => {
    // Update document.body.style.overflow with the right-hand side value.
    document.body.style.overflow = 'auto';
    render(<NullContainerHarness open />);
    // Assert that the value matches the intended expectation.
    expect(document.body.style.overflow).toBe('hidden');

    // Create the event constant.
    const event = new KeyboardEvent('keydown', {
      // Provide the key field value.
      key: 'Tab',
      // Provide the bubbles field value.
      bubbles: true,
      // Provide the cancelable field value.
      cancelable: true,
    });
    // Create the prevented constant.
    const prevented = vi.spyOn(event, 'preventDefault');
    // Call document.dispatchEvent to perform this step.
    document.dispatchEvent(event);
    // Assert that the value matches the intended expectation.
    expect(prevented).not.toHaveBeenCalled();
  });
});
