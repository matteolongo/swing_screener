import { useQuery } from '@tanstack/react-query';
import { fetchScreenerRecurrence } from './recurrenceApi';

export function useScreenerRecurrence() {
  return useQuery({
    queryKey: ['screener', 'recurrence'],
    queryFn: fetchScreenerRecurrence,
    staleTime: 1000 * 60 * 10,
  });
}
