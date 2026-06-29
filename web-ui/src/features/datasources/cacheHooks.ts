import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { fetchCacheStatus, clearCache } from './cacheApi';

export function useCacheStatus() {
  return useQuery({
    queryKey: queryKeys.cacheStatus(),
    queryFn: fetchCacheStatus,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useClearCacheMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => clearCache(id),
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.cacheStatus() });
    },
  });
}
