/**
 * Loads date-ranged performance metrics for one car.
 */
import { useState } from 'react';
// Import named exports from '@tanstack/react-query'.
import { useQuery } from '@tanstack/react-query';
// Import named exports from '../../../api/admin/analytics'.
import { getCarPerformance } from '../../../api/admin/analytics';
// Import named exports from './carDetailTypes'.
import { defaultPerfRange, type Tab } from './carDetailTypes';

/**
 * Date-ranged performance metrics for one car (only while the Performance tab is active).
 * @param id - Car id
 * @param tab - Active detail tab
 */
export function useCarPerformance(id: string, tab: Tab) {
  // Destructure array values into local variables.
  const [perfRange, setPerfRange] = useState(defaultPerfRange);

  // Create the perf query constant.
  const perfQuery = useQuery({
    // Provide the query key field value.
    queryKey: ['admin', 'cars', id, 'performance', perfRange.from, perfRange.to],
    // Provide the query fn field value.
    queryFn: () => getCarPerformance(id, perfRange.from, perfRange.to),
    // Avoid fetching analytics while the user is on another tab.
    enabled: Boolean(id) && tab === 'performance',
  });

  // Return the resulting value to the caller.
  return {
    // Contribute this line to the enclosing declaration or statement.
    perfQuery,
    // Contribute this line to the enclosing declaration or statement.
    perfRange,
    // Contribute this line to the enclosing declaration or statement.
    setPerfRange,
  };
}
