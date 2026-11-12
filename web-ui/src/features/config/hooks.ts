import { useQuery } from '@tanstack/react-query';
import { fetchConfigDefaults } from '@/features/config/api';
import { queryKeys } from '@/lib/queryKeys';

export function useConfigDefaultsQuery() {
  return useQuery({
    queryKey: queryKeys.configDefaults(),
    queryFn: fetchConfigDefaults,
    staleTime: 5 * 60 * 1000,
  });
}
