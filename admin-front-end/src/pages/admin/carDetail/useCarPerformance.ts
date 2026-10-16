/**
 * Loads date-ranged performance metrics for one car.
 */
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCarPerformance } from '../../../api/admin/analytics';
import { defaultPerfRange, type Tab } from './carDetailTypes';

/**
 * Date-ranged performance metrics for one car (only while the Performance tab is active).
 * @param id - Car id
 * @param tab - Active detail tab
 */
export function useCarPerformance(id: string, tab: Tab) {
  const [perfRange, setPerfRange] = useState(defaultPerfRange);

  const perfQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'performance', perfRange.from, perfRange.to],
    queryFn: () => getCarPerformance(id, perfRange.from, perfRange.to),
    // Avoid fetching analytics while the user is on another tab.
    enabled: Boolean(id) && tab === 'performance',
  });

  return {
    perfQuery,
    perfRange,
    setPerfRange,
  };
}
