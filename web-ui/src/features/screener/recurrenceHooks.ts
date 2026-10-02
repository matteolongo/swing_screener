import { useQuery } from '@tanstack/react-query';
import { fetchScreenerRecurrence } from './recurrenceApi';
import { queryKeys } from '@/lib/queryKeys';

export function useScreenerRecurrence() {
  return useQuery({
    queryKey: queryKeys.screenerRecurrence(),
    queryFn: fetchScreenerRecurrence,
    staleTime: 1000 * 60 * 10,
  });
}
