import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getCarPerformance } from '../../../api/admin/analytics';
import { defaultPerfRange, type Tab } from './carDetailTypes';

export function useCarPerformance(id: string, tab: Tab) {
  const [perfRange, setPerfRange] = useState(defaultPerfRange);

  const perfQuery = useQuery({
    queryKey: ['admin', 'cars', id, 'performance', perfRange.from, perfRange.to],
    queryFn: () => getCarPerformance(id, perfRange.from, perfRange.to),
    enabled: Boolean(id) && tab === 'performance',
  });

  return {
    perfQuery,
    perfRange,
    setPerfRange,
  };
}
