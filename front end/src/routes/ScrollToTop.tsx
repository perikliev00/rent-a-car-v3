import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Resets window scroll on PUSH/REPLACE navigations.
 * Leaves browser back/forward (POP) alone so history scroll restoration can work.
 * When a hash target exists, scrolls that element into view instead of forcing top.
 *
 * @returns `null` — this component only runs a scroll side effect.
 * @remarks Side effect: scrolls the window or a hash target element on route changes.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    // Preserve native back/forward scroll restoration.
    if (navigationType === 'POP') return;

    if (hash) {
      // Strip `#` and decode so ids with spaces/special chars still resolve.
      const id = decodeURIComponent(hash.slice(1));
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView();
        return;
      }
      // Fall through to top-of-page if the hash target is missing.
    }

    // Instant jump avoids animating over long pages on every in-app navigation.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash, navigationType]);

  return null;
}
