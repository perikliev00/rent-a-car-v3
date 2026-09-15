import { useEffect, useRef } from 'react';

let lockCount = 0;
let previousOverflow = '';

function lockBodyScroll() {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
  }
  lockCount += 1;
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Body scroll lock + basic focus trap/restore for Modal and Drawer. */
export function useOverlayLock(open: boolean, containerRef: React.RefObject<HTMLElement | null>) {
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocus.current = document.activeElement as HTMLElement | null;
    lockBodyScroll();

    const container = containerRef.current;
    const focusables = () =>
      container
        ? (Array.from(container.querySelectorAll(FOCUSABLE)) as HTMLElement[]).filter(
            (el) => !el.hasAttribute('disabled') && el.tabIndex !== -1
          )
        : [];

    const id = window.requestAnimationFrame(() => {
      const nodes = focusables();
      (nodes[0] ?? container)?.focus?.();
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !container) return;
      const nodes = focusables();
      if (nodes.length === 0) {
        event.preventDefault();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
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
