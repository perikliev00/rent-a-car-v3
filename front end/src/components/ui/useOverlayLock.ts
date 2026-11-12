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
  // Evaluate the condition and enter the branch when it is true.
  if (lockCount === 0) {
    // Update previousOverflow with the right-hand side value.
    previousOverflow = document.body.style.overflow;
    // Update document.body.style.overflow with the right-hand side value.
    document.body.style.overflow = 'hidden';
  }
  // Update lockCount with the right-hand side value.
  lockCount += 1;
}

/**
 * Decrement the scroll-lock refcount and restore overflow when the last lock exits.
 *
 * @remarks Side effect: restores `document.body.style.overflow` when the outermost overlay closes.
 */
function unlockBodyScroll() {
  // Update lockCount with the right-hand side value.
  lockCount = Math.max(0, lockCount - 1);
  // Evaluate the condition and enter the branch when it is true.
  if (lockCount === 0) {
    // Update document.body.style.overflow with the right-hand side value.
    document.body.style.overflow = previousOverflow;
  }
}

/** CSS selector for tabbable elements inside an overlay panel. */
const FOCUSABLE =
  // Continue the surrounding logic with this statement.
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Body scroll lock + basic focus trap/restore for Modal and Drawer.
 *
 * @param open - Whether the overlay is currently visible.
 * @param containerRef - Ref to the dialog/drawer panel that should own focus.
 * @remarks Side effects while open: locks body scroll, focuses the first tabbable, traps Tab, restores focus on close.
 */
export function useOverlayLock(open: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  // Create the previous focus constant.
  const previousFocus = useRef<HTMLElement | null>(null);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Idle when closed — do not touch scroll or focus.
    if (!open) return;

    // Remember the trigger so we can restore focus after close.
    previousFocus.current = document.activeElement as HTMLElement | null;
    // Call lockBodyScroll to perform this step.
    lockBodyScroll();

    // Create the container constant.
    const container = containerRef.current;
    // Create the focusables constant.
    const focusables = () =>
      // Reference the identifier used by the enclosing expression.
      container
        // Continue the surrounding logic with this statement.
        ? (Array.from(container.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter(
            // Continue the surrounding logic with this statement.
            (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
          )
        // Contribute this line to the enclosing declaration or statement.
        : [];

    // Wait a frame so the panel is in the DOM before moving focus.
    const id = window.requestAnimationFrame(() => {
      // Create the nodes constant.
      const nodes = focusables();
      // Continue the surrounding logic with this statement.
      (nodes[0] ?? container)?.focus?.();
    });

    // Create the on key down constant.
    const onKeyDown = (event: KeyboardEvent) => {
      // Only intercept Tab for the focus cycle.
      if (event.key !== 'Tab' || !container) return;
      // Create the nodes constant.
      const nodes = focusables();
      // No tabbables: swallow Tab so focus cannot escape behind the overlay.
      if (nodes.length === 0) {
        // Call event.preventDefault to perform this step.
        event.preventDefault();
        // Return control to the caller with the following value.
        return;
      }
      // Create the first constant.
      const first = nodes[0];
      // Create the last constant.
      const last = nodes[nodes.length - 1];
      // Shift+Tab on first → wrap to last.
      if (event.shiftKey && document.activeElement === first) {
        // Call event.preventDefault to perform this step.
        event.preventDefault();
        // Call last.focus to perform this step.
        last.focus();
      // Continue the surrounding logic with this statement.
      } else if (!event.shiftKey && document.activeElement === last) {
        // Tab on last → wrap to first.
        event.preventDefault();
        // Call first.focus to perform this step.
        first.focus();
      }
    };

    // Call document.addEventListener to perform this step.
    document.addEventListener('keydown', onKeyDown);
    // Return the resulting value to the caller.
    return () => {
      // Call window.cancelAnimationFrame to perform this step.
      window.cancelAnimationFrame(id);
      // Call document.removeEventListener to perform this step.
      document.removeEventListener('keydown', onKeyDown);
      // Call unlockBodyScroll to perform this step.
      unlockBodyScroll();
      // Return focus to the element that opened the overlay.
      previousFocus.current?.focus?.();
    };
  // Continue the surrounding logic with this statement.
  }, [open, containerRef]);
}
