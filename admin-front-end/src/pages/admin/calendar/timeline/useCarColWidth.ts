/**
 * Measures/resizes the sticky car-name column width.
 */
import { useEffect, useState } from 'react';
// Import named exports from './timelineLayout'.
import { CAR_COL, CAR_COL_NARROW } from './timelineLayout';

/**
 * Responsive car-label column width for fleet timeline / month grid.
 * Uses `matchMedia('(max-width: 640px)')` to switch between {@link CAR_COL} and {@link CAR_COL_NARROW}.
 */
export function useCarColWidth() {
  // Destructure array values into local variables.
  const [width, setWidth] = useState(CAR_COL);
  // Call useEffect to perform this step.
  useEffect(() => {
    // SSR / non-browser guards.
    if (typeof window.matchMedia !== 'function') return;
    // Create the mq constant.
    const mq = window.matchMedia('(max-width: 640px)');
    // Create the apply constant.
    const apply = () => setWidth(mq.matches ? CAR_COL_NARROW : CAR_COL);
    // Call apply to perform this step.
    apply();
    // Call mq.addEventListener to perform this step.
    mq.addEventListener('change', apply);
    // Return the resulting value to the caller.
    return () => mq.removeEventListener('change', apply);
  // Continue the surrounding logic with this statement.
  }, []);
  // Return the resulting value to the caller.
  return width;
}
