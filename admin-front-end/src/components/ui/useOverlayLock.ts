/**
 * Ref-counted body scroll lock plus Tab focus trap for Modal/Drawer.
 */
import { useEffect, useRef } from 'react';

/** Nested modal/drawer opens share one body lock via ref-counting. */
let lockCount = 0;
let previousOverflow = '';

/** Increment the lock; on first lock, stash and hide body overflow. */
function lockBodyScroll() {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

/** Decrement the lock; restore previous overflow when the last overlay closes. */
function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Body scroll lock + basic focus trap/restore for Modal and Drawer.
 * Side effects while `open`: locks scroll, focuses first focusable, traps Tab,
 * and restores prior focus on cleanup.
 *
 * @param open - Whether the overlay is currently shown
 * @param containerRef - Ref to the overlay panel that contains focusables
 */
export function useOverlayLock(open: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Remember focus so we can restore it when the overlay closes.
    previousFocus.current = document.activeElement as HTMLElement | null;
    lockBodyScroll();

    const container = containerRef.current;
    const focusables = () =>
      container
        ? (Array.from(container.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter(
            (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
          )
        : [];

    // Defer focus until after paint so the panel is in the DOM.
    const id = window.requestAnimationFrame(() => {
      const nodes = focusables();
      (nodes[0] ?? container)?.focus?.();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !container) return;
      const nodes = focusables();
      // No focusables: swallow Tab so focus cannot escape to the page behind.
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      // Cycle Shift+Tab from first → last, Tab from last → first.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
      previousFocus.current?.focus?.();
    };
  }, [open, containerRef]);
}
