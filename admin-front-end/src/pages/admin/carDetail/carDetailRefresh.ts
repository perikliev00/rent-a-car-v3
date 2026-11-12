/**
 * Query invalidation helpers after car detail mutations.
 */
import type { QueryClient } from '@tanstack/react-query';

/**
 * Invalidate the single-car detail query and the fleet cars list.
 * @param queryClient - App QueryClient
 * @param id - Car id whose detail page was mutated
 */
export function refreshCar(queryClient: QueryClient, id: string) {
  queryClient.invalidateQueries({ queryKey: ['admin', 'cars', id] });
  queryClient.invalidateQueries({ queryKey: ['admin', 'cars'] });
}
