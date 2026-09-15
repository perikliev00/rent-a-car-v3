import { useEffect, useState } from 'react';
import { CAR_COL, CAR_COL_NARROW } from './timelineLayout';

/** Responsive car-label column width for fleet timeline / month grid. */
export function useCarColWidth() {
  const [width, setWidth] = useState(CAR_COL);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(max-width: 640px)');
    const apply = () => setWidth(mq.matches ? CAR_COL_NARROW : CAR_COL);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);
  return width;
}
