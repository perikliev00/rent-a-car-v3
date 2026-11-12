/**
 * Ref-counted body scroll lock plus Tab focus trap for Modal/Drawer.
 */
import { useEffect, useRef } from 'react';

/** Nested modal/drawer opens share one body lock via ref-counting. */
let lockCount = 0;
// Initialize the mutable previous overflow variable.
let previousOverflow = '';

/** Increment the lock; on first lock, stash and hide body overflow. */
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

/** Decrement the lock; restore previous overflow when the last overlay closes. */
function unlockBodyScroll() {
  // Update lockCount with the right-hand side value.
  lockCount = Math.max(0, lockCount - 1);
  // Evaluate the condition and enter the branch when it is true.
  if (lockCount === 0) {
    // Update document.body.style.overflow with the right-hand side value.
    document.body.style.overflow = previousOverflow;
  }
}

// Create the focusable constant.
const FOCUSABLE =
  // Continue the surrounding logic with this statement.
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
  // Create the previous focus constant.
  const previousFocus = useRef<HTMLElement | null>(null);

  // Call useEffect to perform this step.
  useEffect(() => {
    // Evaluate the condition and enter the branch when it is true.
    if (!open) return;

    // Remember focus so we can restore it when the overlay closes.
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

    // Defer focus until after paint so the panel is in the DOM.
    const id = window.requestAnimationFrame(() => {
      // Create the nodes constant.
      const nodes = focusables();
      // Continue the surrounding logic with this statement.
      (nodes[0] ?? container)?.focus?.();
    });

    // Create the on key down constant.
    const onKeyDown = (event: KeyboardEvent) => {
      // Evaluate the condition and enter the branch when it is true.
      if (event.key !== 'Tab' || !container) return;
      // Create the nodes constant.
      const nodes = focusables();
      // No focusables: swallow Tab so focus cannot escape to the page behind.
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
      // Cycle Shift+Tab from first → last, Tab from last → first.
      if (event.shiftKey && document.activeElement === first) {
        // Call event.preventDefault to perform this step.
        event.preventDefault();
        // Call last.focus to perform this step.
        last.focus();
      // Continue the surrounding logic with this statement.
      } else if (!event.shiftKey && document.activeElement === last) {
        // Call event.preventDefault to perform this step.
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
      // Continue the surrounding logic with this statement.
      previousFocus.current?.focus?.();
    };
  // Continue the surrounding logic with this statement.
  }, [open, containerRef]);
}
