// Import named exports from 'react'.
import { useEffect } from 'react';
// Import named exports from 'react-router-dom'.
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
  // Destructure object properties into local variables.
  const { pathname, hash } = useLocation();
  // Create the navigation type constant.
  const navigationType = useNavigationType();

  // Call useEffect to perform this step.
  useEffect(() => {
    // Preserve native back/forward scroll restoration.
    if (navigationType === 'POP') return;

    // Evaluate the condition and enter the branch when it is true.
    if (hash) {
      // Strip `#` and decode so ids with spaces/special chars still resolve.
      const id = decodeURIComponent(hash.slice(1));
      // Create the el constant.
      const el = document.getElementById(id);
      // Evaluate the condition and enter the branch when it is true.
      if (el) {
        // Call el.scrollIntoView to perform this step.
        el.scrollIntoView();
        // Return control to the caller with the following value.
        return;
      }
      // Fall through to top-of-page if the hash target is missing.
    }

    // Instant jump avoids animating over long pages on every in-app navigation.
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  // Continue the surrounding logic with this statement.
  }, [pathname, hash, navigationType]);

  // Return the resulting value to the caller.
  return null;
}
