import type { QueryClient } from '@tanstack/react-query';

export function refreshCar(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'cars'] });
}
