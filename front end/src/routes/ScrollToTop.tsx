import { useEffect } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';

/**
 * Resets window scroll on PUSH/REPLACE navigations.
 * Leaves browser back/forward (POP) alone so history scroll restoration can work.
 * When a hash target exists, scrolls that element into view instead of forcing top.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === 'POP') return;

    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView();
        return;
      }
    }

    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname, hash, navigationType]);

  return null;
}
