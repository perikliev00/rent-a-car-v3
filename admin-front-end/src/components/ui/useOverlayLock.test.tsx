import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useOverlayLock } from './useOverlayLock';

async function flushAnimationFrames() {
  await act(async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
  });
}

function OverlayHarness({
  open,
  children,
}: {
  open: boolean;
  children?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlayLock(open, ref);
  return (
    <div ref={ref} tabIndex={-1} data-testid="overlay-container">
      {children}
    </div>
  );
}

function NullContainerHarness({ open }: { open: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useOverlayLock(open, ref);
  return <div data-testid="outside">outside</div>;
}

describe('useOverlayLock', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('does nothing when closed', () => {
    document.body.style.overflow = 'auto';
    render(
      <OverlayHarness open={false}>
        <button type="button">One</button>
      </OverlayHarness>,
    );
    expect(document.body.style.overflow).toBe('auto');
  });

  it('locks body overflow while open and restores it on close', async () => {
    document.body.style.overflow = 'scroll';
    const { rerender, unmount } = render(
      <OverlayHarness open>
        <button type="button">One</button>
      </OverlayHarness>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    rerender(
      <OverlayHarness open={false}>
        <button type="button">One</button>
      </OverlayHarness>,
    );
    await waitFor(() => {
      expect(document.body.style.overflow).toBe('scroll');
    });

    unmount();
  });

  it('supports nested scroll locks and restores only after the last unlock', () => {
    document.body.style.overflow = 'visible';
    const first = render(
      <OverlayHarness open>
        <button type="button">First</button>
      </OverlayHarness>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    const second = render(
      <OverlayHarness open>
        <button type="button">Second</button>
      </OverlayHarness>,
    );
    expect(document.body.style.overflow).toBe('hidden');

    first.unmount();
    expect(document.body.style.overflow).toBe('hidden');

    second.unmount();
    expect(document.body.style.overflow).toBe('visible');
  });

  it('focuses the first focusable element when opened', async () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    render(
      <OverlayHarness open>
        <button type="button">First</button>
        <button type="button">Second</button>
      </OverlayHarness>,
    );

    await flushAnimationFrames();
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();

    trigger.remove();
  });

  it('falls back to the container when there are no focusable children', async () => {
    render(<OverlayHarness open />);
    await flushAnimationFrames();
    expect(screen.getByTestId('overlay-container')).toHaveFocus();
  });

  it('prevents Tab when the container has no focusable elements', async () => {
    render(<OverlayHarness open />);
    await flushAnimationFrames();

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    const prevented = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    expect(prevented).toHaveBeenCalled();
  });

  it('wraps Tab from the last focusable to the first', async () => {
    render(
      <OverlayHarness open>
        <button type="button">First</button>
        <button type="button">Last</button>
      </OverlayHarness>,
    );
    await flushAnimationFrames();

    screen.getByRole('button', { name: 'Last' }).focus();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: 'First' })).toHaveFocus();
  });

  it('wraps Shift+Tab from the first focusable to the last', async () => {
    render(
      <OverlayHarness open>
        <button type="button">First</button>
        <button type="button">Last</button>
      </OverlayHarness>,
    );
    await flushAnimationFrames();

    screen.getByRole('button', { name: 'First' }).focus();
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Last' })).toHaveFocus();
  });

  it('restores previous focus on cleanup', async () => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.textContent = 'Trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const { unmount } = render(
      <OverlayHarness open>
        <button type="button">Inside</button>
      </OverlayHarness>,
    );
    await flushAnimationFrames();
    expect(screen.getByRole('button', { name: 'Inside' })).toHaveFocus();

    unmount();
    expect(trigger).toHaveFocus();
    trigger.remove();
  });

  it('ignores keyboard trapping when the container ref is not attached', async () => {
    document.body.style.overflow = 'auto';
    render(<NullContainerHarness open />);
    expect(document.body.style.overflow).toBe('hidden');

    const event = new KeyboardEvent('keydown', {
      key: 'Tab',
      bubbles: true,
      cancelable: true,
    });
    const prevented = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);
    expect(prevented).not.toHaveBeenCalled();
  });
});
