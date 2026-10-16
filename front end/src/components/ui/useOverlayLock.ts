/**
 * Shared overlay accessibility helpers for Modal and Drawer.
 * A ref-counted body scroll lock allows nested overlays without restoring
 * scroll too early; focus is trapped inside the open container and restored on close.
 */
import { useEffect, useRef } from 'react';

/** Nested open overlays increment this so scroll unlock only runs at the outermost close. */
let lockCount = 0;
/** Cached `document.body.style.overflow` restored when the outermost lock releases. */
let previousOverflow = '';

/**
 * Increment the scroll-lock refcount and hide body overflow on the first lock.
 *
 * @remarks Side effect: mutates `document.body.style.overflow` when entering the first lock.
 */
function lockBodyScroll() {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

/**
 * Decrement the scroll-lock refcount and restore overflow when the last lock exits.
 *
 * @remarks Side effect: restores `document.body.style.overflow` when the outermost overlay closes.
 */
function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

/** CSS selector for tabbable elements inside an overlay panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Body scroll lock + basic focus trap/restore for Modal and Drawer.
 *
 * @param open - Whether the overlay is currently visible.
 * @param containerRef - Ref to the dialog/drawer panel that should own focus.
 * @remarks Side effects while open: locks body scroll, focuses the first tabbable, traps Tab, restores focus on close.
 */
export function useOverlayLock(open: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Idle when closed — do not touch scroll or focus.
    if (!open) return;

    // Remember the trigger so we can restore focus after close.
    previousFocus.current = document.activeElement as HTMLElement | null;
    lockBodyScroll();

    const container = containerRef.current;
    const focusables = () =>
      container
        ? (Array.from(container.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter(
            (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
          )
        : [];

    // Wait a frame so the panel is in the DOM before moving focus.
    const id = window.requestAnimationFrame(() => {
      const nodes = focusables();
      (nodes[0] ?? container)?.focus?.();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      // Only intercept Tab for the focus cycle.
      if (event.key !== 'Tab' || !container) return;
      const nodes = focusables();
      // No tabbables: swallow Tab so focus cannot escape behind the overlay.
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      // Shift+Tab on first → wrap to last.
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        // Tab on last → wrap to first.
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.cancelAnimationFrame(id);
      document.removeEventListener('keydown', onKeyDown);
      unlockBodyScroll();
      // Return focus to the element that opened the overlay.
      previousFocus.current?.focus?.();
    };
  }, [open, containerRef]);
}
